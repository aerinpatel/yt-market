import { useEffect, useRef, useState } from 'react'

import './App.css'

interface ChannelData {
  name: string;
  subscriber: number;
  views: number;
  videos: number;
}


function App() {
  const [data, setData] = useState<ChannelData[]>([]);
  const socketRef = useRef<WebSocket|null>(null);
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen=()=>{
      console.log("socket opened");
      ws.send("hellu");
    }
    ws.onmessage = (msg) =>{
      setData(msg.data);
    }
    
    socketRef.current =ws;
    return () => ws.close();
  },[]);
  return (
    <>
      {data}
    </>
  )
}

export default App
