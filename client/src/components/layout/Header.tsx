import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import UserAvatar from "@/components/UserAvatar";
import { 
  Search, 
  Phone, 
  Bell, 
  Moon, 
  Sun, 
  Menu,
  LogOut, 
  Settings, 
  User 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export default function Header({ onMobileMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [notificationCount] = useState(3); // Mock notification count
  
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };
  
  return (
    <header className="bg-white dark:bg-dark-200 border-b border-gray-200 dark:border-dark-100 shadow-sm">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden mr-2 text-gray-500 dark:text-gray-400"
            onClick={onMobileMenuToggle}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center text-white font-bold">
              CH
            </div>
            <h1 className="text-xl font-semibold">ChatHub</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Search button */}
          <Button variant="ghost" size="icon" className="text-gray-600 dark:text-gray-300">
            <Search className="h-5 w-5" />
          </Button>
          
          {/* Call history button */}
          <Button variant="ghost" size="icon" className="text-gray-600 dark:text-gray-300">
            <Phone className="h-5 w-5" />
          </Button>
          
          {/* Notifications button */}
          <Button variant="ghost" size="icon" className="text-gray-600 dark:text-gray-300 relative">
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center">
                {notificationCount}
              </Badge>
            )}
          </Button>
          
          {/* Dark mode toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            className="text-gray-600 dark:text-gray-300"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          
          {/* User profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <UserAvatar
                  user={user}
                  className="h-8 w-8 border-2 border-primary"
                  showStatus
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center justify-start p-2">
                <UserAvatar user={user} className="h-8 w-8 mr-2" />
                <div className="flex flex-col">
                  <p className="font-medium text-sm">{user?.displayName}</p>
                  <p className="text-xs text-gray-500">@{user?.username}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
