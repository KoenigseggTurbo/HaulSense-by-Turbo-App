
"use client"

import { 
  LayoutDashboard, 
  Truck, 
  Receipt, 
  FileText, 
  Settings, 
  LogOut,
  LogIn
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth, initiateSignOut } from "@/firebase"
import { doc } from "firebase/firestore"
import { AppSettings } from "@/lib/types"
import { Button } from "@/components/ui/button"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const db = useFirestore()
  const auth = useAuth()

  const settingsRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, "users", user.uid, "settings", "prefs")
  }, [db, user])

  const { data: settings } = useDoc<AppSettings>(settingsRef)

  const isGuest = !user || user.isAnonymous
  const displayName = settings?.displayName || (user?.displayName) || (user?.email?.split('@')[0]) || (isGuest ? "Guest Driver" : "Driver")
  const truckId = settings?.truckId || (isGuest ? "Demo Mode" : "No Truck ID")
  
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || "D"

  const handleSignOut = () => {
    if (auth) {
      initiateSignOut(auth)
      router.push('/login')
    }
  }

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-4 flex flex-row items-center gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white flex items-center justify-center border border-slate-100 shadow-sm">
          <Image 
            src="/logo.png" 
            alt="HaulSense By Turbo Logo" 
            fill 
            sizes="40px"
            unoptimized
            className="object-cover w-full h-full"
            data-ai-hint="truck logo"
          />
        </div>
        <div className="flex flex-col">
          <h1 className="text-base font-bold tracking-tight text-foreground font-headline leading-none">HaulSense</h1>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">By Turbo</p>
        </div>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Main Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-1">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className={`transition-all duration-200 ${
                      pathname === item.url 
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/10" 
                        : "hover:bg-sidebar-accent"
                    }`}
                  >
                    <Link href={item.url} className="flex items-center gap-3 px-3 py-2">
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-border bg-muted/20">
        <div className="flex items-center gap-3 px-2 py-2 mb-4">
          <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center border border-accent/20 shadow-inner">
            <span className="text-accent-foreground font-bold">{initials}</span>
          </div>
          <div className="flex flex-col truncate">
            <span className="text-sm font-bold truncate">{displayName}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-black truncate">{truckId}</span>
          </div>
        </div>
        
        {isGuest ? (
          <Button 
            className="w-full h-10 font-bold bg-primary hover:bg-primary/90" 
            onClick={() => router.push('/login')}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Sign In / Register
          </Button>
        ) : (
          <SidebarMenuButton 
            className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive font-bold h-10"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5 mr-3" />
            <span>Sign Out</span>
          </SidebarMenuButton>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Loads",
    url: "/loads",
    icon: Truck,
  },
  {
    title: "Expenses",
    url: "/expenses",
    icon: Receipt,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: FileText,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
]
