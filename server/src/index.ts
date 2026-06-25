import express from "express";
import { prisma } from "./lib/prisma.js";
import WebSocket,{WebSocketServer} from 'ws';
import axios, { isCancel, AxiosError } from 'axios';

const app = express();
app.use(express.json());
const wss = new WebSocketServer({port:8080});

interface DataType{
  name:string
  subscriber:number;
  views:number;
  videos:number;
}
const channels:Array<string> = ["MrBeast","BigBangTheory","Friends","Manware","NeetCode"];
const data:Array<DataType> = [];
// GET https://www.googleapis.com/youtube/v3/channels


function startToFeedData(){
  channels.forEach(async (channel) => {
    const res = await axios.get(`https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${channel}&key=AIzaSyDMozvWOwMATLodI-_lcIFIES5xDfQ8HG4`);

    data.push({name:channel,views:Number(res.data.items[0].statistics.viewCount),subscriber:Number(res.data.items[0].statistics.subscriberCount),videos:Number(res.data.items[0].statistics.videoCount)});
  })
    
}

async function feedData(){
  channels.forEach(async (channel) => {
    const res = await axios.get(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${channel}&key=AIzaSyDMozvWOwMATLodI-_lcIFIES5xDfQ8HG4`
  );
  data.forEach((ele) => {
      if(ele.name == channel){
        ele.views = Number(res.data.items[0].statistics.viewCount);
        ele.subscriber = Number(res.data.items[0].statistics.subscriberCount);
        ele.videos = Number(res.data.items[0].statistics.videoCount);
      }
    });
  // console.log(process.env.)
  console.log("-------------------------------------");
  })
}
function broadcastData() {
  wss.clients.forEach((client:WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
startToFeedData();
setInterval(async () => {
  await feedData();
  broadcastData();
  console.log(data);
}, 10000);




// app.listen(3000, () => {
//   console.log("Server running on port 3000");
// });