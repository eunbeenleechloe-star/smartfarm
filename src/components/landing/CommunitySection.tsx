"use client";

import { useState } from "react";
import ScrollReveal from "@/components/landing/ScrollReveal";

type Comment = { id: number; author: string; text: string };
type Post = {
  id: number;
  title: string;
  author: string;
  date: string;
  content: string;
  comments: Comment[];
};

const INITIAL_POSTS: Post[] = [
  {
    id: 1,
    title: "오이 노지재배 첫 도전, 장마철 과습 관리 조언 부탁드려요",
    author: "새싹농부",
    date: "2026-07-10",
    content:
      "이번에 처음으로 오이를 노지에 심어보려고 하는데, 장마철 과습 관리는 어떻게 하시나요? 두둑을 얼마나 높여야 할지 감이 안 잡히네요.",
    comments: [
      {
        id: 1,
        author: "흙기사팀",
        text: "배수로 정비와 두둑 높이를 15cm 이상 확보하시는 걸 추천드려요. 적합도 진단 결과의 강수량 항목도 함께 참고해보세요.",
      },
    ],
  },
  {
    id: 2,
    title: "사과 적합도 점수가 낮게 나왔는데 괜찮을까요?",
    author: "과수원지기",
    date: "2026-07-18",
    content:
      "분석 결과 적합도 점수가 생각보다 낮게 나왔어요. 다른 분들은 어떤 기준으로 재배 여부를 결정하시나요?",
    comments: [],
  },
];

type View = "list" | "write" | "detail";

export default function CommunitySection() {
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [commentText, setCommentText] = useState("");

  const selectedPost = posts.find((post) => post.id === selectedId) ?? null;

  function openDetail(id: number) {
    setSelectedId(id);
    setView("detail");
  }

  function backToList() {
    setView("list");
    setSelectedId(null);
    setCommentText("");
  }

  function submitPost(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const newPost: Post = {
      id: Date.now(),
      title: title.trim(),
      author: "익명",
      date: new Date().toISOString().slice(0, 10),
      content: content.trim(),
      comments: [],
    };
    setPosts((prev) => [newPost, ...prev]);
    setTitle("");
    setContent("");
    setView("list");
  }

  function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!commentText.trim() || selectedId === null) return;

    setPosts((prev) =>
      prev.map((post) =>
        post.id === selectedId
          ? {
              ...post,
              comments: [
                ...post.comments,
                { id: Date.now(), author: "익명", text: commentText.trim() },
              ],
            }
          : post
      )
    );
    setCommentText("");
  }

  return (
    <section id="community" className="bg-background px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <ScrollReveal className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-text">커뮤니티</h2>
            <p className="mt-2 text-muted">다른 농업인들과 경험과 궁금증을 나눠보세요.</p>
          </div>
          {view === "list" && (
            <button
              type="button"
              onClick={() => setView("write")}
              className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              글쓰기
            </button>
          )}
        </ScrollReveal>

        <ScrollReveal delay={0.1} className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
          {view === "list" && (
            <ul className="divide-y divide-border">
              {posts.map((post) => (
                <li key={post.id}>
                  <button
                    type="button"
                    onClick={() => openDetail(post.id)}
                    className="w-full py-4 text-left"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="font-semibold text-text">{post.title}</h3>
                      <span className="shrink-0 text-xs text-muted">
                        {post.author} · {post.date}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-muted">{post.content}</p>
                  </button>
                </li>
              ))}
              {posts.length === 0 && (
                <li className="py-8 text-center text-sm text-muted">아직 게시글이 없어요.</li>
              )}
            </ul>
          )}

          {view === "write" && (
            <form onSubmit={submitPost} className="space-y-4">
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="제목"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
              />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="내용을 입력하세요"
                rows={6}
                className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-text hover:border-primary"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  등록
                </button>
              </div>
            </form>
          )}

          {view === "detail" && selectedPost && (
            <div>
              <button
                type="button"
                onClick={backToList}
                className="text-sm font-medium text-muted hover:text-primary"
              >
                ← 목록으로
              </button>

              <h3 className="mt-4 text-xl font-bold text-text">{selectedPost.title}</h3>
              <p className="mt-1 text-xs text-muted">
                {selectedPost.author} · {selectedPost.date}
              </p>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text">
                {selectedPost.content}
              </p>

              <div className="mt-8 border-t border-border pt-6">
                <h4 className="text-sm font-semibold text-text">
                  댓글 {selectedPost.comments.length}
                </h4>
                <ul className="mt-3 space-y-3">
                  {selectedPost.comments.map((comment) => (
                    <li key={comment.id} className="rounded-xl bg-background px-4 py-2.5 text-sm">
                      <span className="font-medium text-text">{comment.author}</span>
                      <span className="ml-2 text-muted">{comment.text}</span>
                    </li>
                  ))}
                  {selectedPost.comments.length === 0 && (
                    <li className="text-sm text-muted">첫 댓글을 남겨보세요.</li>
                  )}
                </ul>

                <form onSubmit={submitComment} className="mt-4 flex items-center gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="댓글을 입력하세요"
                    className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                  >
                    등록
                  </button>
                </form>
              </div>
            </div>
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}
