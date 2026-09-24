from datetime import timedelta

from genesis.conversation.engine import ThinkFilter, clean_reply
from genesis.conversation.prompts import second_person
from genesis.db.models import Goal, Message, Task
from genesis.llm.base import ChatResult, ToolCall
from genesis.timeutil import utcnow
from tests.conftest import system_prompt


def test_chat_round_trip_and_history(client):
    r = client.post("/api/chat", json={"message": "Hello there"})
    body = r.json()
    assert r.status_code == 200
    assert body["reply"] and body["conversation_id"] and body["mood"]
    assert set(body["emotion"]) == {"happy", "curious", "focused", "relaxed", "excited", "concerned", "reflective", "motivated"}
    conv = client.get(f"/api/conversations/{body['conversation_id']}").json()
    assert [m["role"] for m in conv["messages"]] == ["user", "assistant"]
    assert client.get("/api/conversations").json()[0]["id"] == body["conversation_id"]


def test_memories_are_injected_into_the_prompt(client, llm):
    client.post("/api/chat", json={"message": "I'm restoring my old fishing boat this summer."})
    client.post("/api/chat", json={"message": "What do you think about boats and fishing trips?"})
    prompt = system_prompt(llm)
    assert "fishing boat" in prompt
    assert "Memories that may be relevant" in prompt


def test_new_conversation_recalls_previous_one(client, llm):
    first = client.post("/api/chat", json={"message": "I'm working on my fishing boat today."}).json()
    client.post("/api/chat", json={"message": "Hello again", "conversation_id": None})
    prompt = system_prompt(llm)
    assert "Your previous conversation" in prompt
    assert first["conversation_id"]


def test_question_directive_follows_fresh_topic(client, llm):
    client.post("/api/chat", json={"message": "I really enjoy fishing."})
    prompt = system_prompt(llm)
    assert "They just mentioned fishing" in prompt


def test_distress_switches_to_care(client, llm):
    client.post("/api/chat", json={"message": "I'm feeling really sad and lonely today."})
    prompt = system_prompt(llm)
    assert "hard time" in prompt
    assert "concerned" in prompt


def test_question_frequency_zero_never_asks(client, llm):
    client.put("/api/settings", json={"question_frequency": 0})
    client.post("/api/chat", json={"message": "I really enjoy fishing."})
    assert "Don't ask a question" in system_prompt(llm)


def test_streaming_emits_meta_tokens_done(client, svc):
    with client.stream("POST", "/api/chat/stream", json={"message": "Tell me something nice"}) as r:
        text = "".join(r.iter_text())
    assert "event: meta" in text and "event: token" in text and "event: done" in text
    with svc.db.session() as s:
        assert s.query(Message).filter_by(role="assistant").count() == 1


def test_llm_offline_still_saves_and_learns(client, llm, svc):
    llm.up = False
    body = client.post("/api/chat", json={"message": "My name is Sam and I love climbing."}).json()
    assert "can't reach my language model" in body["reply"]
    assert client.get("/api/profile").json()["fields"]["name"]["value"] == "Sam"


def test_tool_calls_are_executed_and_logged(client, script, svc):
    calls = {"n": 0}

    def reply(messages, opts):
        calls["n"] += 1
        if opts.get("tools") and calls["n"] == 1:
            return ChatResult(content="", tool_calls=[ToolCall("create_task", {"title": "Buy bait", "due_at": "2030-01-01T09:00:00"})])
        return "Done, I've added that task."

    script.reply = reply
    body = client.post("/api/chat", json={"message": "Can you add a task to buy bait tomorrow?"}).json()
    assert body["tool_calls"][0]["name"] == "create_task" and body["tool_calls"][0]["ok"]
    with svc.db.session() as s:
        assert s.query(Task).one().title == "Buy bait"
    assert client.get("/api/tools/logs").json()[0]["tool_name"] == "create_task"


def test_tool_loop_is_bounded(client, script):
    script.reply = lambda m, o: ChatResult(content="", tool_calls=[ToolCall("get_time", {})]) if o.get("tools") else "final"
    body = client.post("/api/chat", json={"message": "what time is it? check the calendar"}).json()
    assert body["reply"] == "final"
    assert len(body["tool_calls"]) <= 3


def test_greeting_first_meeting_then_goal_follow_up(client, svc, script):
    script.reply = lambda m, o: ""  # force the template path
    first = client.post("/api/chat/greeting").json()
    assert "What should I call you?" in first["reply"]

    client.post("/api/chat", json={"message": "I want to learn Python properly."})
    with svc.db.session() as s:
        g = s.query(Goal).filter(Goal.owner == "user").one()
        g.next_follow_up_at = utcnow() - timedelta(hours=1)
    again = client.post("/api/chat/greeting").json()
    assert "learn python" in again["reply"].lower() and again["reply"].endswith("?")
    with svc.db.session() as s:
        g = s.query(Goal).filter(Goal.owner == "user").one()
        assert g.next_follow_up_at > utcnow()


def test_think_blocks_are_hidden():
    f = ThinkFilter()
    out = "".join(f.feed(c) for c in ["Hel", "lo <thi", "nk>secret plan</th", "ink> there"]) + f.flush()
    assert out == "Hello  there"
    assert clean_reply("<think>hmm</think>Genesis: Hi!", "Genesis") == "Hi!"


def test_second_person_rewrite():
    assert second_person("The user is restoring their fishing boat.") == "you were restoring your fishing boat"
