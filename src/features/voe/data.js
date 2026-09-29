export const CATEGORIES = ["L0 SPIDER", "L1 SPIDER", "L3 SPIDER", "Defect SPIDER", "기타"]

export const STATUS = {
  waiting: { label: "답변 대기", variant: "amber" },
  active: { label: "답변 중", variant: "blue" },
  completed: { label: "답변 완료", variant: "default" },
}

export function filterPosts(posts, status = "all") {
  return posts.filter((post) => !post.hidden && (status === "all" || post.status === status))
}
