import { createRoot } from "react-dom/client"
import { flushSync } from "react-dom"
import { MAX_CHART_IMAGE_BYTES } from "./chartMail.mjs"

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))

function blobDataUrl(blob) {
  if (blob.size > MAX_CHART_IMAGE_BYTES) throw new Error("차트 이미지가 5MB를 초과합니다.")
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error("차트 이미지를 읽지 못했습니다."))
    reader.readAsDataURL(blob)
  })
}

export async function loadChartPng(url) {
  const resolved = new URL(url, window.location.origin)
  if (resolved.origin !== window.location.origin) throw new Error("차트 이미지 주소를 확인해 주세요.")
  const response = await fetch(resolved, { credentials: "same-origin" })
  if (!response.ok) throw new Error("차트 이미지를 불러오지 못했습니다.")
  const blob = await response.blob()
  const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
  if (signature.join(",") !== "137,80,78,71,13,10,26,10") throw new Error("PNG 차트 이미지를 확인해 주세요.")
  if (blob.size > MAX_CHART_IMAGE_BYTES) throw new Error("차트 이미지가 5MB를 초과합니다.")
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("빈 이미지입니다.")
  } catch {
    throw new Error("차트 이미지를 읽지 못했습니다. 다시 시도해 주세요.")
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
  return blobDataUrl(new Blob([blob], { type: "image/png" }))
}

// Render a separate full-domain chart; never change the visible chart's zoom.
export async function renderChartPng(chart) {
  const container = document.createElement("div")
  container.style.cssText = "position:fixed;left:-10000px;top:0;width:1200px;height:480px;background:white;color:#172033;pointer-events:none"
  container.setAttribute("aria-hidden", "true")
  document.body.append(container)
  const root = createRoot(container)
  let objectUrl
  try {
    await document.fonts.ready
    flushSync(() => root.render(chart))
    let svg
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await frame()
      svg = container.querySelector("svg.recharts-surface")
      if (svg?.querySelector(".recharts-scatter-symbol")) break
    }
    if (!svg?.querySelector(".recharts-scatter-symbol")) throw new Error("전체 범위 차트를 준비하지 못했습니다. 다시 시도해 주세요.")
    const clone = svg.cloneNode(true)
    const originals = [svg, ...svg.querySelectorAll("*")]
    const copies = [clone, ...clone.querySelectorAll("*")]
    originals.forEach((element, index) => {
      const style = getComputedStyle(element)
      for (const property of ["fill", "stroke", "stroke-width", "stroke-dasharray", "font-family", "font-size", "font-weight", "opacity", "text-anchor", "dominant-baseline"]) {
        copies[index].style.setProperty(property, style.getPropertyValue(property))
      }
    })
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    clone.setAttribute("width", "1200")
    clone.setAttribute("height", "480")
    objectUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }))
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = 1200
    canvas.height = 480
    const context = canvas.getContext("2d")
    context.fillStyle = "white"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!blob) throw new Error("차트 이미지 생성에 실패했습니다.")
    return await blobDataUrl(blob)
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    root.unmount()
    container.remove()
  }
}
