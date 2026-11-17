"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { Link } from "react-router-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  ChartNoAxesCombinedIcon,
  CommandIcon,
  LandmarkIcon,
  WalletIcon,
  UsersIcon,
  ShieldCheckIcon,
  HandCoinsIcon,
} from "lucide-react"
import type { UserSession } from "@/lib/api-types"
import { hasAllPermissions, hasPermission, permissions } from "@/lib/permissions"

export function AppSidebar({
  user,
  onLogout,
  activeUrl,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: UserSession
  onLogout: () => void
  activeUrl: string
}) {
  const financeItems = [
    ...(hasAllPermissions(user.permissions, [
      permissions.tillsRead,
      permissions.movementsRead,
    ], user.is_admin)
      ? [{
          title: "Resumen",
          url: "/dashboard",
          icon: <ChartNoAxesCombinedIcon />,
        }]
      : []),
    ...(hasPermission(user.permissions, permissions.tillsRead, user.is_admin)
      ? [{
          title: "Cajas",
          url: "/dashboard/cajas",
          icon: <WalletIcon />,
        }]
      : []),
    ...(hasPermission(user.permissions, permissions.assetsRead, user.is_admin)
      ? [{
          title: "Patrimonios",
          url: "/dashboard/patrimonios",
          icon: <LandmarkIcon />,
        }]
      : []),
    ...(hasPermission(user.permissions, permissions.debtsRead, user.is_admin)
      ? [{
          title: "Deudas",
          url: "/dashboard/deudas",
          icon: <HandCoinsIcon />,
        }]
      : []),
  ]
  const adminItems = [
    ...(hasPermission(user.permissions, permissions.usersRead, user.is_admin)
      ? [{
          title: "Usuarios",
          url: "/dashboard/usuarios",
          icon: <UsersIcon />,
        }]
      : []),
    ...(hasPermission(user.permissions, permissions.profilesRead, user.is_admin)
      ? [{
          title: "Perfiles",
          url: "/dashboard/perfiles",
          icon: <ShieldCheckIcon />,
        }]
      : []),
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link to="/dashboard">
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">Mis Ahorros</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {financeItems.length > 0 && (
          <NavMain
            title="Finanzas"
            items={financeItems}
            activeUrl={activeUrl}
          />
        )}
        {adminItems.length > 0 && (
          <NavMain
            title="Administración"
            items={adminItems}
            activeUrl={activeUrl}
          />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: `${user.name} ${user.last_name}`,
            email: user.username,
            avatar: user.avatar_url ?? "",
          }}
          onLogout={onLogout}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
