from datetime import timedelta

from genesis.db.models import PersonalityTrait, Relationship
from genesis.emotion.engine import BASELINE, appraise, decay
from genesis.personality.engine import MAX_DAILY, TraitSignal
from genesis.relationship.engine import LEVELS
from genesis.timeutil import utcnow


def test_personality_drift_is_capped_per_day(svc):
    with svc.db.session() as s:
        before = svc.personality.values(s)["humour"]
        for _ in range(50):
            svc.personality.apply(s, [TraitSignal("humour", 5.0, "test")])
        after = svc.personality.values(s)["humour"]
        assert 0 < after - before <= MAX_DAILY + 1e-6


def test_personality_never_strays_far_from_baseline(svc):
    with svc.db.session() as s:
        t = s.query(PersonalityTrait).filter_by(name="confidence").one()
        for day in range(200):
            t.drift_date = f"2000-01-{day:03d}"  # new day each time: fresh budget
            svc.personality.apply(s, [TraitSignal("confidence", -1.0, "test")])
        assert t.value >= t.baseline - 30


def test_emotions_react_and_decay():
    a = appraise("I'm so stressed and overwhelmed with this deadline")
    assert "stress" in a.cues and a.valence < 0
    spiked = {**BASELINE, "concerned": 80.0}
    later = decay(spiked, utcnow() - timedelta(hours=6))
    assert BASELINE["concerned"] < later["concerned"] < 80
    assert abs(decay(spiked, utcnow() - timedelta(days=5))["concerned"] - BASELINE["concerned"]) < 1


def test_emotion_endpoint_reflects_conversation(client):
    client.post("/api/chat", json={"message": "I finally got the job!! I'm so happy!"})
    data = client.get("/api/emotions").json()
    assert data["current"]["happy"] > BASELINE["happy"]
    assert data["mood"] in {"happy", "excited", "motivated"}
    assert len(data["history"]) >= 1


def test_relationship_levels_need_time_not_just_messages(svc):
    with svc.db.session() as s:
        for _ in range(500):
            svc.relationship.record_turn(s, "honestly I feel like you really get me, thanks", ["gratitude"])
        r = s.query(Relationship).one()
        assert r.interaction_count == 500
        assert r.level == "Acquaintance"  # plenty of messages, but all on one day: no instant best friends
        r.days_active = 40
        svc.relationship.record_turn(s, "thanks", ["gratitude"])
        assert [lvl[0] for lvl in LEVELS].index(r.level) >= 2


def test_relationship_endpoint_shape(client):
    client.post("/api/chat", json={"message": "hey"})
    data = client.get("/api/relationship").json()
    assert data["level"] == "Acquaintance" and data["interaction_count"] == 1
    assert data["next_level"] == "Familiar" and 0 <= data["progress_to_next"] <= 100


def test_personality_endpoint_and_profile_update(client):
    data = client.get("/api/personality").json()
    assert {t["name"] for t in data["traits"]} >= {"curiosity", "empathy", "humour", "loyalty"}
    updated = client.put("/api/personality/profile", json={"humour_style": "dry and gentle", "question_frequency": 30}).json()
    assert updated["profile"]["humour_style"] == "dry and gentle"
    assert updated["profile"]["question_frequency"] == 30
