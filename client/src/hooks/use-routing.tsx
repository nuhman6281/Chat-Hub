import { useEffect, useRef, useCallback, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useChat } from "@/contexts/ChatContext";

interface RouteParams {
  workspaceId?: string;
  channelId?: string;
  dmId?: string;
}

export function useRouting() {
  const [location, navigate] = useLocation();
  const params = useParams<RouteParams>();
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    channels,
    activeChannel,
    setActiveChannel,
    directMessages,
    activeDM,
    setActiveDM,
    isLoadingWorkspaces,
    isLoadingChannels,
  } = useChat();

  const [isNavigating, setIsNavigating] = useState(false);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performNavigation = useCallback(
    (path: string) => {
      setIsNavigating(true);
      navigate(path);
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      navigationTimeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
        navigationTimeoutRef.current = null;
      }, 300); // Increased timeout to be safer
    },
    [navigate]
  );

  const navigateToWorkspace = useCallback(
    (workspaceId: number) => {
      performNavigation(`/workspace/${workspaceId}`);
    },
    [performNavigation]
  );

  const navigateToChannel = useCallback(
    (workspaceId: number, channelId: number) => {
      performNavigation(`/workspace/${workspaceId}/channel/${channelId}`);
    },
    [performNavigation]
  );

  const navigateToDirectMessage = useCallback(
    (dmId: number) => {
      performNavigation(`/dm/${dmId}`);
    },
    [performNavigation]
  );

  useEffect(() => {
    // This single effect now handles all routing logic.
    // It's driven by URL changes and data loading states.

    if (isNavigating || isLoadingWorkspaces) {
      return; // Wait for navigation to complete and workspaces to be loaded
    }

    const { workspaceId, channelId, dmId } = params;

    // ======== 1. Handle DM Routing ========
    if (dmId) {
      const dmIdNum = parseInt(dmId, 10);
      if (activeDM?.id !== dmIdNum) {
        const dmToSelect = directMessages.find((dm) => dm.id === dmIdNum);
        if (dmToSelect) {
          setActiveDM(dmToSelect);
          if (activeChannel) setActiveChannel(null);
          if (activeWorkspace) setActiveWorkspace(null);
        }
      }
      return; // DM routing is exclusive
    }

    // ======== 2. Handle Workspace/Channel Routing ========
    if (workspaceId) {
      const workspaceIdNum = parseInt(workspaceId, 10);

      // --- Set Active Workspace ---
      if (activeWorkspace?.id !== workspaceIdNum) {
        const workspaceToSelect = workspaces.find(
          (w) => w.id === workspaceIdNum
        );
        if (workspaceToSelect) {
          setActiveWorkspace(workspaceToSelect);
          if (activeDM) setActiveDM(null); // Clear DM state
        }
        // If workspace isn't found, maybe it's still loading or invalid.
        // We might want to handle this case, e.g., redirect to a known good state.
        return; // Return here to wait for workspace-related data to load.
      }

      // Wait for channels to be loaded for the active workspace
      if (isLoadingChannels) {
        return;
      }

      // --- Set Active Channel (or auto-select) ---
      if (channelId) {
        const channelIdNum = parseInt(channelId, 10);
        if (activeChannel?.id !== channelIdNum) {
          const channelToSelect = channels.find((c) => c.id === channelIdNum);
          if (channelToSelect) {
            setActiveChannel(channelToSelect);
          }
        }
      } else {
        // No channel in URL, clear active channel or auto-select
        if (activeChannel) {
          setActiveChannel(null);
        }
        // Auto-select first channel if conditions are right
        if (channels.length > 0) {
          const firstChannel = channels[0];
          // Check location to prevent loop, navigate to the first channel
          if (!location.includes(`/channel/${firstChannel.id}`)) {
            navigateToChannel(workspaceIdNum, firstChannel.id);
          }
        }
      }
    } else if (workspaces.length > 0) {
      // ======== 3. Handle Root/Fallback Routing ========
      // If no workspace is in the URL, navigate to the first one.
      navigateToWorkspace(workspaces[0].id);
    }
  }, [
    params,
    location,
    isNavigating,
    isLoadingWorkspaces,
    isLoadingChannels,
    workspaces,
    channels,
    directMessages,
    activeWorkspace,
    activeChannel,
    activeDM,
    setActiveWorkspace,
    setActiveChannel,
    setActiveDM,
    navigateToWorkspace,
    navigateToChannel,
  ]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  return {
    navigateToWorkspace,
    navigateToChannel,
    navigateToDirectMessage,
    isNavigating,
  };
}
