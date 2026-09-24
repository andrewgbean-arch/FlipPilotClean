import pytest

from genesis.llm.fake import HashEmbedder

chromadb = pytest.importorskip("chromadb")


def test_chroma_store_round_trip(tmp_path):
    from genesis.memory.vector_store import ChromaVectorStore

    emb = HashEmbedder()
    store = ChromaVectorStore(tmp_path / "chroma", emb.model_name)
    vecs = emb.embed(["fishing boat on the sea", "baking sourdough bread"])
    store.upsert([1, 2], vecs, [{"user_id": 1}, {"user_id": 1}])
    hits = store.query(emb.embed(["boat fishing trip"])[0], 2, where={"user_id": 1})
    assert hits[0][0] == 1 and hits[0][1] > hits[1][1]
    assert store.ids() == {1, 2} and store.count() == 2
    store.delete([1])
    assert store.ids() == {2}
    # Persistence: a new client sees the same data.
    assert ChromaVectorStore(tmp_path / "chroma", emb.model_name).count() == 1
