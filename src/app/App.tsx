import { LogDock } from "@/app/LogDock"
import { MainPanel } from "@/app/MainPanel"
import { Sidebar } from "@/app/Sidebar"

export default function App() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <MainPanel />
        <LogDock />
      </main>
    </div>
  )
}
