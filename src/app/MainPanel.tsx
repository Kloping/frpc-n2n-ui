export function MainPanel() {
  return (
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-background px-6 text-center">
      <p className="text-lg">选择左侧的服务器</p>
      <p className="text-[13px] text-muted-foreground">
        启动后可以逐条查看转发的连接状态
      </p>
    </section>
  )
}
