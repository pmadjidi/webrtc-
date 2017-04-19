/** browser dependent definition are aligned to one and the same standard name **/
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition
  || window.msSpeechRecognition || window.oSpeechRecognition;

var config = {
  wssHost: 'wss://aka.ite.kth.se/websocket/'
  // wssHost: 'wss://example.com/myWebSocket'
};
var localVideoElem = null,
  remoteVideoElem = null,
  localVideoStream = null,
  videoCallButton = null,
  endCallButton = null;
  resetButton = null;
  statusWindow = null;
var peerConn = null,
  wsc = new WebSocket(config.wssHost),
  peerConnCfg = {'iceServers':
    [{'url': 'stun:stun.services.mozilla.com'},
     {'url': 'stun:stun.l.google.com:19302'}]
  };



function pageReady() {
  // check browser WebRTC availability
  if(navigator.getUserMedia) {
    videoCallButton = document.getElementById("videoCallButton");
    endCallButton = document.getElementById("endCallButton");
    resetButton = document.getElementById("resetButton");
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    statusWindow = document.getElementById('statusWindow');
    statusWindow.value = "Not connected yet.........\nReady to call........."
    videoCallButton.removeAttribute("disabled");
    videoCallButton.addEventListener("click", initiateCall);
    endCallButton.addEventListener("click", function (evt) {
      wsc.send(JSON.stringify({"closeConnection": true }));
    });

    resetButton.addEventListener("click", function (evt) {
      wsc.send(JSON.stringify({"closeConnection": true }));
      console.log("Reset Called.......",evt)
      location.reload();
    });

  } else {
    alert("Sorry, your browser does not support WebRTC!")
  }
};

function prepareCall() {
  statusWindow.value += "\nReady to recive call....."
  peerConn = new RTCPeerConnection(peerConnCfg);
  // send any ice candidates to the other peer
  peerConn.onicecandidate = onIceCandidateHandler;
  // once remote stream arrives, show it in the remote video element
  peerConn.onaddstream = onAddStreamHandler;
};

// run start(true) to initiate a call
function initiateCall() {
  prepareCall();
  statusWindow.value += "\nInitating a call......"
  // get the local stream, show it in the local video element and send it
  navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
    localVideoStream = stream;
    localVideo.src = URL.createObjectURL(localVideoStream);
    peerConn.addStream(localVideoStream);
    createAndSendOffer();
    statusWindow.value += "\nSending Offer to peer......"
  }, function(error) { console.log(error);
  statusWindow.value += "\nError......"});
};

function answerCall() {
  prepareCall();
  statusWindow.value += "\nAbout to Answering Call......"
  // get the local stream, show it in the local video element and send it
  navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
    localVideoStream = stream;
    localVideo.src = URL.createObjectURL(localVideoStream);
    peerConn.addStream(localVideoStream);
    createAndSendAnswer();
    statusWindow.value += "\nAnswering call, peer notfied......"
  }, function(error) { console.log(error)
  statusWindow.value += "\nError......"  ;});
};

wsc.onmessage = function (evt) {
  console.log("EVENT: ",evt)
  var signal = null;
  if (!peerConn) answerCall();
  signal = JSON.parse(evt.data);
  if (signal.sdp) {
    console.log("Received SDP from remote peer.");
    statusWindow.value += "\nReceived SDP from remote peer......"
    console.log(JSON.stringify(signal.sdp,null,4))
    peerConn.setRemoteDescription(new RTCSessionDescription(signal.sdp));
  }
  else if (signal.candidate) {
    console.log("Received ICECandidate from remote peer.");
    statusWindow.value += "\nReceived ICECandidate from remote peer......"
    peerConn.addIceCandidate(new RTCIceCandidate(signal.candidate))
    .catch(err=>console.log("In Error",err));
  } else if ( signal.closeConnection){
    console.log("Received 'close call' signal from remote peer.");
    statusWindow.value += "\nAbout to tear down the call......."
    endCall();
  }
};

function createAndSendOffer() {
  resetButton.removeAttribute("disabled");
  peerConn.createOffer(
    function (offer) {
      var off = new RTCSessionDescription(offer);
      peerConn.setLocalDescription(new RTCSessionDescription(off),
        function() {
          wsc.send(JSON.stringify({"sdp": off }));
        },
        function(error) { console.log(error);}
      );
    },
    function (error) { console.log(error);}
  );
};

function createAndSendAnswer() {
  peerConn.createAnswer(
    function (answer) {
      var ans = new RTCSessionDescription(answer);
      peerConn.setLocalDescription(ans, function() {
          wsc.send(JSON.stringify({"sdp": ans }));
        },
        function (error) { console.log(error);}
      );
    },
    function (error) {console.log(error);}
  );
};

function onIceCandidateHandler(evt) {
  if (!evt || !evt.candidate) return;
  wsc.send(JSON.stringify({"candidate": evt.candidate }));
};

function onAddStreamHandler(evt) {
  videoCallButton.setAttribute("disabled", true);
  endCallButton.removeAttribute("disabled");
  // set remote video stream as source for remote video HTML5 element
  remoteVideo.src = URL.createObjectURL(evt.stream);
};

function endCall() {
  statusWindow.value += "\nCall Terminated......"
  peerConn.close();
  history.go(0);
  peerConn = null;
  videoCallButton.removeAttribute("disabled");
  endCallButton.setAttribute("disabled", true);
  if (localVideoStream) {
    localVideoStream.getTracks().forEach(function (track) {
      track.stop();
    });
    localVideo.src = "";
  }
  if (remoteVideo) remoteVideo.src = "";
  history.go(0)
};
