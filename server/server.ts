import { createServer } from "node:http";
import { Server } from "socket.io";

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
  },
});

io.on("connection", (socket) => {
  console.log(`socket ${socket.id} connected`);

  socket.on("join", ({ roomId, userId }) => {
    console.log({ roomId, userId });
    socket.join(roomId);
    socket.broadcast.to(roomId).emit("user-connected", { userId });
  });

  socket.on("offer", ({ roomId, offer }) => {
    console.log("offer");
    socket.broadcast.to(roomId).emit("offer", { offer });
  });
  socket.on("answer", ({ roomId, answer }) => {
    console.log("answer");
    socket.broadcast.to(roomId).emit("answer", { answer });
  });
  socket.on("offer-candidate", ({ roomId, candidate }) => {
    console.log("offer-candidate");
    socket.broadcast.to(roomId).emit("offer-candidate", { candidate });
  });
  socket.on("answer-candidate", ({ roomId, candidate }) => {
    console.log("answer-candidate");
    socket.broadcast.to(roomId).emit("answer-candidate", { candidate });
  });

  socket.on("disconnect", (reason) => {
    console.log(`socket ${socket.id} disconnected due to ${reason}`);
  });
});

httpServer.listen(3000);

declare global {
  interface ImportMeta {
    readonly hot?: any;
  }
}

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeFullReload", () => {
    httpServer.close();
  });

  import.meta.hot.dispose(() => {
    httpServer.close();
  });
}
