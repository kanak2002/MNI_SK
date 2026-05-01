import { useState } from "react";
import ChatWindow from "./components/ChatWindow.jsx";
import LandingIntro from "./components/LandingIntro.jsx";

function App() {
  const [showChat, setShowChat] = useState(false);

  if (!showChat) {
    return <LandingIntro onLaunch={() => setShowChat(true)} />;
  }

  return <ChatWindow />;
}

export default App;
