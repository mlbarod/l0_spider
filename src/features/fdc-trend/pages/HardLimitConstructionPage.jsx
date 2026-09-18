import { ArrowLeft, Construction } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function HardLimitConstructionPage() {
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-[#f5f5f7] px-6 py-16">
      <section className="w-full max-w-lg rounded-[18px] border border-[#d2d2d7] bg-white p-8 text-center sm:p-12">
        <Construction className="mx-auto mb-6 size-12 text-[#7a7a7a]" aria-hidden="true" />
        <Badge variant="secondary" className="mb-4">개발중</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">FDC Hard Limit추천</h1>
        <p className="mt-4 text-xl font-medium text-[#55555a]">Under Construction</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          현재 기능을 준비 중입니다. 준비가 완료되면 이용하실 수 있습니다.
        </p>
        <Button asChild variant="outline" className="mt-8">
          <Link to="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            메인 화면으로
          </Link>
        </Button>
      </section>
    </main>
  )
}
