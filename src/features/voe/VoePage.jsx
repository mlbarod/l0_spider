import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { QnaApp } from "./QnaApp"
import { qnaRepository, request } from "./repository"

export function VoePage() {
  const [searchParams] = useSearchParams()
  const [identity, setIdentity] = useState(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    qnaRepository.reset()
    request("/api/voe/identity").then((value) => { if (active) setIdentity(value) })
      .catch((failure) => { if (active) setError(failure.message) })
    return () => { active = false; qnaRepository.reset() }
  }, [])
  if (!identity) return <main className="grid flex-1 place-items-center"><div className="space-y-4 text-center"><p role={error ? "alert" : "status"}>{error || "VOE 게시판을 불러오고 있습니다."}</p><Link to="/" className="underline">SPIDER 메인</Link></div></main>
  return <div className="min-h-0 flex-1"><QnaApp key={searchParams.get("questionId") || "list"} initialQuestionId={searchParams.get("questionId")} user={identity.user} role={identity.role} /></div>
}
