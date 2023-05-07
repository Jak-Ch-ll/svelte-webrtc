<script lang="ts">
    import { io } from "socket.io-client";

    const queryParams = new URLSearchParams(location.search);

    const roomId = queryParams.get("room");

    if (!roomId) {
        location.assign(`?room=${crypto.randomUUID()}`);
    }

    const socket = io("localhost:3000");

    let userConnected = false;

    socket.on("user-connected", ({ userId }) => {
        console.log(`User with id ${userId} connected`);
        userConnected = true;
    });

    const servers = {
        iceServers: [
            {
                urls: [
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                ],
            },
        ],
        iceCandidatePoolSize: 10,
    };

    const connection = new RTCPeerConnection();
    let dataChannel = connection.createDataChannel("mychannel");
    dataChannel.onopen = () => console.log("Opening data channel!");
    dataChannel.onmessage = (event) => console.log(event.data);

    let localVideo: HTMLVideoElement;
    let remoteVideo: HTMLVideoElement;

    const userId = crypto.randomUUID();
    console.log("UserId:", userId);

    let host = false;

    socket.emit("join", { roomId, userId });
    socket.on("offer-candidate", ({ candidate }) => {
        if (host) return;

        console.log("on:offer-candidate");

        if (!candidate) return;

        const iceCandidate = new RTCIceCandidate(candidate);
        connection.addIceCandidate(iceCandidate);
    });

    let hasOffer = false;
    let remoteOffer: RTCSessionDescriptionInit;
    socket.on("offer", async ({ offer }) => {
        if (host) return;

        console.log("on:offer", offer);

        hasOffer = true;
        remoteOffer = offer;

        connection.onicecandidate = ({ candidate }) => {
            console.log("emit:answer-candidate", { candidate });
            socket.emit("answer-candidate", { roomId, candidate });
        };
        connection.ondatachannel = (event) => {
            console.log("ondatachannel", { event });
            dataChannel = event.channel;
            dataChannel.onopen = () => console.log("Opening data channel!");
            dataChannel.onmessage = (event) => console.log(event.data);
        };

        await connection.setRemoteDescription(offer);
    });

    async function activateWebcam() {
        const localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });

        localStream.getTracks().forEach((track) => {
            console.log("AddTrack", { track });
            connection.addTrack(track, localStream);
        });

        const remoteStream = new MediaStream();

        connection.ontrack = (event) => {
            console.log("ontrack", { event });
            event.streams[0].getTracks().forEach((track) => {
                console.log("ontrack:addTrack", { track });
                remoteStream.addTrack(track);
            });
        };

        localVideo.srcObject = localStream;
        remoteVideo.srcObject = remoteStream;
    }

    async function startCall() {
        this.host = true;

        connection.onicecandidate = ({ candidate }) => {
            console.log("emit:offer-candidate", { candidate });
            socket.emit("offer-candidate", { roomId, candidate });
        };

        const offerDescription = await connection.createOffer();
        await connection.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        };

        console.log("emit:offer");
        socket.emit("offer", { roomId, offer });

        socket.on("answer", ({ answer }) => {
            console.log("on:answer", { answer });
            console.log({
                currentRemoteDescription: connection.currentRemoteDescription,
            });
            if (!connection.currentRemoteDescription) {
                connection.setRemoteDescription(answer);
            }
        });

        socket.on("answer-candidate", ({ candidate }) => {
            console.log("on:answer-candidate", { candidate });
            if (!candidate) return;
            const iceCandidate = new RTCIceCandidate(candidate);
            connection.addIceCandidate(iceCandidate);
        });
    }

    async function answerCall(offer: RTCSessionDescriptionInit) {
        console.log("answerCall", { offer });

        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        console.log("emit:answer");
        socket.emit("answer", { roomId, answer });
    }
</script>

<main>
    <h2>1. Start your Webcam</h2>
    <div class="videos">
        <span>
            <h3>Local Stream</h3>
            <video bind:this={localVideo} muted autoplay playsinline>
                <track kind="captions" />
            </video>
        </span>
        <span>
            <h3>Remote Stream</h3>
            <video bind:this={remoteVideo} autoplay playsinline>
                <track kind="captions" />
            </video>
        </span>
    </div>

    <button on:click={activateWebcam}>Start webcam</button>
    <h2>2. Create a new Call</h2>
    <button on:click={startCall} disabled={!userConnected}>
        Create Call (offer)
    </button>

    <h2>3. Join a Call</h2>
    <p>Answer the call from a different browser window or device</p>

    <button on:click={() => answerCall(remoteOffer)} disabled={!hasOffer}
        >Answer</button
    >

    <h2>4. Hangup</h2>
    <button on:click={() => console.dir(localVideo.srcObject)}
        >Test Local</button
    >
    <button on:click={() => console.dir(remoteVideo.srcObject)}
        >Test Remote</button
    >
    <button on:click={() => dataChannel.send("Hello!")}>Send Message</button>
</main>

<style>
    video {
        width: 40vw;
        height: 30vw;
        margin: 2rem;
        background: #2c3e50;
    }

    .videos {
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
