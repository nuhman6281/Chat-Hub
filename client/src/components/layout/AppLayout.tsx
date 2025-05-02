// import { ReactNode, useState } from "react";
// import Header from "@/components/layout/Header";
// import WorkspaceSidebar from "@/components/layout/WorkspaceSidebar";
// import ChannelSidebar from "@/components/layout/ChannelSidebar";
// import MessageList from "@/components/chat/MessageList";
// import MessageInput from "@/components/chat/MessageInput";
// import ChannelHeader from "@/components/chat/ChannelHeader";
// import { useChat } from "@/hooks/useChat";
// import VideoCallModal from "@/components/modals/VideoCallModal";
// import VoiceCallModal from "@/components/modals/VoiceCallModal";
// import CreateChannelModal from "@/components/modals/CreateChannelModal";
// import CreateDirectMessageModal from "@/components/modals/CreateDirectMessageModal";

// interface AppLayoutProps {
//   children?: ReactNode;
// }

// export default function AppLayout({ children }: AppLayoutProps) {
//   const { activeChat } = useChat();
//   const [showVideoCallModal, setShowVideoCallModal] = useState(false);
//   const [showVoiceCallModal, setShowVoiceCallModal] = useState(false);
//   const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
//   const [showCreateDMModal, setShowCreateDMModal] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

//   return (
//     <div className="h-screen flex flex-col">
//       <Header onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

//       <div className="flex flex-1 overflow-hidden">
//         <WorkspaceSidebar className={mobileMenuOpen ? "hidden md:flex" : ""} />

//         <ChannelSidebar
//           className={mobileMenuOpen ? "flex" : "hidden md:flex"}
//           onCreateChannel={() => setShowCreateChannelModal(true)}
//           onCreateDirectMessage={() => setShowCreateDMModal(true)}
//         />

//         <div className="flex-1 flex flex-col">
//           {activeChat ? (
//             <>
//               <ChannelHeader
//                 onVideoCall={() => setShowVideoCallModal(true)}
//                 onVoiceCall={() => setShowVoiceCallModal(true)}
//               />

//               <MessageList />

//               <MessageInput />
//             </>
//           ) : (
//             <div className="flex-1 flex items-center justify-center bg-light-200 dark:bg-dark-300">
//               <div className="text-center p-8">
//                 <div className="h-16 w-16 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
//                   CH
//                 </div>
//                 <h1 className="text-2xl font-bold mb-2">Welcome to ChatHub</h1>
//                 <p className="text-gray-600 dark:text-gray-400">
//                   Select a channel or conversation to start messaging
//                 </p>
//               </div>
//             </div>
//           )}

//           {children}
//         </div>
//       </div>

//       {/* Modals */}
//       <VideoCallModal
//         isOpen={showVideoCallModal}
//         onClose={() => setShowVideoCallModal(false)}
//       />

//       <VoiceCallModal
//         isOpen={showVoiceCallModal}
//         onClose={() => setShowVoiceCallModal(false)}
//       />

//       <CreateChannelModal
//         isOpen={showCreateChannelModal}
//         onClose={() => setShowCreateChannelModal(false)}
//       />

//       <CreateDirectMessageModal
//         isOpen={showCreateDMModal}
//         onClose={() => setShowCreateDMModal(false)}
//       />
//     </div>
//   );
// }
