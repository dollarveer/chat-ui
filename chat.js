let new_chats = 0;
let new_session = 0;

let currentIdentity = "";
let currentChatUserHash = "";
let selectedFiles = [];
let currentEditMessageId = "";
let currentReplyMessageId = "";
let chatMessages = {};
let aliasMap = {};
let countdownTimers = {};
let currentChatPrint = "";
let currentTotalUsers = "";

let isMute = localStorage.getItem('isMute') === "true";
let vibrate = localStorage.getItem('vibrate') === "true";

function openSearch() {
  document.getElementById('search-input-container').style.display = 'block';
  document.getElementById('search-button').style.display = 'none';
}

function cancelSearch() {
  document.getElementById('search-input-container').style.display = 'none';
  document.getElementById('search-button').style.display = 'block';

  const bubbles = document.querySelectorAll('.message-bubble');

  bubbles.forEach(bubble => {
    const textElement = bubble.querySelector('p');
    const originalText = textElement.textContent;
    textElement.innerHTML = originalText;
    bubble.style.display = "block";
  });
}
function toggleMute() {
  const muteEl = document.getElementById("toggleMute");

  isMute = isMute ? false: true;
  localStorage.setItem('isMute', isMute);
  muteEl.innerHTML = isMute ? "&#128263;": "&#128266;";
}
function copyChatCode() {
  const chatCode = document.getElementById("header-chat-code").innerText;
  navigator.clipboard.writeText(chatCode);
  alert("Chat code copied.");
}

function scrollToTop() {
  const chatBox = document.getElementById("chatBox");
  chatBox.scrollTop = 0;
}

function reportChat() {
  alert("Chat reported.");
}

function toggleChatHeaderDropdown() {
  const menu = document.getElementById('chatHeaderDropdownMenu');
  menu.style.display = (menu.style.display === 'flex') ? 'none': 'flex';
}

function toggleMenu(btn) {
  const dropdown = btn.nextElementSibling;
  dropdown.style.display = dropdown.style.display === 'block' ? 'none': 'block';

  const bubble = btn.closest('.bubbleWrapper');
  const rawTimestamp = bubble.dataset.timestamp;
  const serverDate = new Date(`${rawTimestamp} GMT-0700`);
  const now = new Date();
  const DELETE_TIMEOUT = 2 * 60 * 60 * 1000;
  const EDIT_TIMEOUT = 45 * 60 * 1000;
  const timeDiff = now - serverDate;
  const isSender = bubble.classList.contains("own");

  if (isSender) {
    dropdown.querySelector('.edit-btn').style.display = timeDiff <= EDIT_TIMEOUT ? 'block': 'none';
    dropdown.querySelector('.delete-btn').style.display = timeDiff <= DELETE_TIMEOUT ? 'block': 'none';
  }
  document.querySelectorAll('.dropdown').forEach(el => {
    if (el !== dropdown) el.style.display = 'none';
  });
}

function replyToMessage(id) {
  currentReplyMessageId = id;

  const text = document.getElementById('message-text-' + id).innerText;

  document.getElementById('reply-text').innerText = `Replying to: "${text}"`;
  document.getElementById('reply-preview').style.display = 'block';
  document.getElementById('reply-preview').setAttribute('data-reply-id',
    id);

  document.getElementById('edit-preview').style.display = 'none';
}

function scrollToOriginalMessage(id = document.getElementById("reply-preview").getAttribute("data-reply-id")) {
  const messageId = id;
  const target = document.getElementById(`message-${messageId}`);

  if (target) {
    target.scrollIntoView({
      behavior: "smooth", block: "center"
    });
    target.classList.add("highlight");
    setTimeout(() => target.classList.remove("highlight"), 1500);
  }
}

function cancelReply(event) {
  event.stopPropagation();
  currentReplyMessageId = null;
  document.getElementById("reply-preview").style.display = "none";
}

function editMessage(id) {
  currentEditMessageId = id;
  const text = document.getElementById('message-text-' + id).innerText;

  document.getElementById("edit-bubble").innerText = text;
  document.getElementById("edit-input").value = text;
  document.getElementById("edit-preview").style.display = "block";

  document.getElementById("reply-preview").style.display = "none";
  document.getElementById("chatInput").value = "";
  document.getElementById("chatInput").disabled = true;
}

function cancelEdit() {
  currentEditMessageId = null;
  document.getElementById("edit-preview").style.display = "none";
  document.getElementById("edit-input").value = '';
  document.getElementById("chatInput").disabled = false;
}

function saveEdit() {
  let updatedText = document.getElementById("edit-input").value;
  updatedText = encryptMessage(updatedText, chatMessages[currentIdentity].chatPrint);
  const formData = new FormData();
  formData.append("new_content", updatedText);
  formData.append("identity", currentIdentity);
  formData.append("messageId", currentEditMessageId);
  formData.append("action", "edit");

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "messaging.php", true);
  xhr.onload = function () {
    if (xhr.status === 200) {
      if (xhr.responseText.trim() === "success") {
        sendUpdatedMessage("edit", currentEditMessageId, updatedText);
        cancelEdit();
        alert("Edited");
      }
    } else {
      alert("Edit Failed");
    }
  };
  xhr.send(formData);
}

function deleteMessage(button, id) {
  const bubble = button.closest('.message-bubble');
  const messageId = id;
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "messaging.php", true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4 && xhr.status === 200) {
      try {
        if (xhr.responseText.trim() === "success") {
          const content = "[deleted]";
          sendUpdatedMessage("delete", messageId, content);
        } else {
          alert(xhr.responseText.trim());
        }
      } catch (e) {}
    }
  };
  xhr.send(`action=delete&identity=${currentIdentity}&messageId=${messageId}`);
}

function handleFiles(files) {
  const preview = document.getElementById("previewContainer");

  [...files].forEach(file => {
    if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) return;

    selectedFiles.push(file);
    const reader = new FileReader();
    reader.onload = function (e) {
      const div = document.createElement("div");
      div.className = "preview-item";

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.innerText = "×";
      removeBtn.onclick = () => {
        selectedFiles = selectedFiles.filter(f => !(f.name === file.name && f.size === file.size));
        preview.removeChild(div);
      };
      div.appendChild(removeBtn);

      if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = e.target.result;
        div.appendChild(img);
      } else if (file.type.startsWith("video/")) {
        const vid = document.createElement("video");
        vid.src = e.target.result;
        vid.controls = true;
        vid.className = "message-video";
        div.appendChild(vid);
      } else {
        const doc = document.createElement("div");
        doc.innerText = file.name;
        doc.style.padding = "5px";
        doc.style.fontSize = "12px";
        div.appendChild(doc);
      }

      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

function formatLocalTime(mysqlTimestamp) {
  const dbDate = new Date(`${mysqlTimestamp} GMT-0700`);
  const utcISOString = dbDate.toISOString();

  const utcDate = new Date(utcISOString);
  const formatted = utcDate.toLocaleString('en-US',
    {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

  return formatted;
}

function renderAlias(sender_hash, your_hash, aliasMap, chatType) {
  if (sender_hash === your_hash) return 'You';

  if (chatType === "Group") {
    if (aliasMap.hasOwnProperty(sender_hash)) {
      return aliasMap[sender_hash];
    } else {
      return false;
    }
  } else {
    return aliasMap[sender_hash] || "User";
  }
}

function addLoadingBubble(isOwner = true) {
  if (document.querySelector('.load-bubble')) {
    return;
  }

  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'load-bubble';
  loadingBubble.classList.add("bubbleWrapper");
  loadingBubble.classList.add(isOwner ? "own": "other");
  loadingBubble.id = 'loading-bubble';

  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'loading-dots';

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    dotsContainer.appendChild(dot);
  }

  loadingBubble.appendChild(dotsContainer);

  const chatbox = document.getElementById('chatBox');
  if (chatbox) {
    chatbox.appendChild(loadingBubble);
  } else {
    console.error('Chatbox element not found');
  }
}

function removeLoadingBubble() {
  const loadingBubble = document.getElementById('loading-bubble');
  if (loadingBubble) {
    loadingBubble.remove();
  }
}

function populateChatBubbles(chatId, newMsgs = 0) {
  const chatBox = document.getElementById("chatBox");
  if (!chatId || !chatBox) return;
  removeLoadingBubble();
  chatBox.innerHTML = "";

  const msgs = chatMessages[chatId].messages;
  const userhash = chatMessages[chatId].userHash;
  const aliasMap = chatMessages[chatId].aliasMap;
  const chatType = chatMessages[chatId].chatType;
  const chatPrint = chatMessages[chatId].chatPrint;
  const total = chatMessages[chatId].totalUsers - 1;
  const oldHeight = chatBox.scrollHeight;
  const oldScrollTop = chatBox.scrollTop;

  if (!msgs || msgs.length === 0) return;
    msgs.forEach(msg => {
      msg = JSON.parse(decryptMessage(msg, chatMessages[chatId].chatPrint).trim());
      const alias = renderAlias(msg.sender_hash, userhash, aliasMap, chatType);
      if (chatType === "Group" && alias === false) return;

      const type = msg.sender_hash === userhash ? 'own': 'other';

      const wrapper = document.createElement('div');
      wrapper.className = 'bubbleWrapper';
      wrapper.classList.add(type);
      wrapper.id = `message-${msg.messageId}`;
      wrapper.dataset.timestamp = `${msg.sent_at}`;
      const bubble = document.createElement('div');
      bubble.className = `${type}Bubble ${type}`;


      // Alias label
      const aliasLabel = document.createElement('span');
      aliasLabel.className = type;
      aliasLabel.style.fontWeight = 'bold';
      aliasLabel.textContent = alias;

      const container = document.createElement('div');
      container.className = `inlineContainer ${type}`;

      const icon = document.createElement('img');
      icon.className = 'inlineIcon';

      if (msg.is_deleted) {
        bubble.innerText = "This message was deleted.";
        bubble.classList.add('deleted-message');
        container.appendChild(icon);
        container.appendChild(bubble);
        wrapper.appendChild(aliasLabel);
        wrapper.appendChild(container);
        chatBox.appendChild(wrapper);
        return;
      }

      icon.src = type === 'own'
      ? 'assets/img/sender.png': 'assets/img/recipient.png';

      const menu_button = document.createElement('span');
      menu_button.className = 'menu-button';
      menu_button.setAttribute("onclick", `toggleMenu(this)`);
      menu_button.textContent = '⋮';

      const dropDownMenu = document.createElement('div');
      dropDownMenu.className = "dropdown";
      let dropDownMenuHtml = `
      <button onclick="replyToMessage(${msg.messageId})">Reply</button>
      `;
      if (type === 'own') {
        dropDownMenuHtml += `
        <button class="edit-btn" onclick="editMessage(${msg.messageId})">Edit</button>
        <button class="delete-btn" onclick="deleteMessage(this, ${msg.messageId})">Delete</button>`;
      }
      dropDownMenu.innerHTML = dropDownMenuHtml;

      let html = '';

      if (msg.reply_to) {
        const replyDiv = document.createElement('div');
        let replyMsg = msgs.find(m => JSON.parse(decryptMessage(m, chatMessages[chatId].chatPrint)).messageId === msg.reply_to);
        replyMsg = JSON.parse(decryptMessage(replyMsg, chatPrint).trim());
        if (replyMsg) {
          const replyAlias = renderAlias(replyMsg.sender_hash, userhash, aliasMap, chatType);
          if (replyAlias === false && chatType === "Group") return;

          const replyText = replyMsg.message_content ? decryptMessage(replyMsg.message_content, chatPrint): '[Original message]';
          replyDiv.setAttribute("onclick", `scrollToOriginalMessage(${replyMsg.messageId})`);
          replyDiv.setAttribute("style", `font-size:13px;color:#ccc;margin-bottom:5px;margin-right: 20px; border-left:2px solid #aaa;padding-left:8px;`);
          replyDiv.innerHTML = ` ↪ <strong>${replyAlias}:</strong></br> ${replyText}`;
          bubble.appendChild(replyDiv);
        }
      }

      const content = document.createElement('p');
      content.id = 'message-text-' + msg.messageId;
      content.innerText = decryptMessage(msg.message_content, chatPrint);
      bubble.appendChild(content);

      if (msg.is_edited) {
        const edited = document.createElement('span');
        edited.innerText = ' (edited)';
        bubble.appendChild(edited);
      }

      if (msg.media_url) {
        try {
          const mediaFiles = JSON.parse(decryptMessage(msg.media_url, chatPrint));
          mediaFiles.forEach(url => {
            const ext = url.split('.').pop().toLowerCase();
            let mediaElement;
            if (['mp4', 'webm', 'ogg'].includes(ext)) {
              mediaElement = document.createElement('video');
              mediaElement.src = "/public/file.php?file=" + url + "&identity="+ chatId;
              mediaElement.setAttribute("style", "max-width:80%;margin-top:8px;");
              mediaElement.controls = true;
            } else if (['mp3', 'wav', 'm4a'].includes(ext)) {
              mediaElement = document.createElement("audio");
              mediaElement.src = "/public/file.php?file=" + url + "&identity="+ chatId;
              mediaElement.setAttribute("style", "margin-top:8px;");
              mediaElement.controls = true;
            } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
              mediaElement = document.createElement('img');
              mediaElement.src = "/public/file.php?file=" + url + "&identity="+ chatId;
              mediaElement.alt = 'Image';
              mediaElement.setAttribute("style", "max-width:80%;margin-top:8px;border-radius:10px;");
            } else {
              const fileName = url.split('/').pop();
              mediaElement = document.createElement('a');
              mediaElement.href = "/public/file.php?file=" + encodeURIComponent(url) + "&identity=" + chatId;
              mediaElement.target = '_blank';
              mediaElement.setAttribute("style", "display:block;margin-top:8px;color:#f0f0f0;");
              mediaElement.innerText = `📄 ${fileName}`;
            }
            bubble.appendChild(mediaElement);
          });
        } catch (e) {
          console.warn("Invalid media JSON for msg:",
            msg.messageId,
            e);
        }
      }

      if (type === 'own') {
        const delivered = msg.delivered_to?.length || 0;
        const read = msg.read_by?.length || 0;

        let tick = '';
        let countText = '';

        if (read >= total) {
          tick = `<span class="tickStatus tick-read">✓✓</span>`;
        } else if (delivered >= total) {
          tick = `<span class="tickStatus">✓✓</span>`;
        } else if (delivered > 0) {
          tick = `<span class="tickStatus">✓✓</span>`;
          countText = `<span class="tickCount"> ${delivered}/${total}</span>`;
        } else {
          tick = `<span class="tickStatus">✓</span>`;
        }

        // For group chat only (totalUsers > 2)
        if (total > 2 && (read < total || delivered < total)) {
          countText = `<span class="tickCount"> ${Math.max(read, delivered)}/${total}</span>`;
        }

        html += `${tick}${countText}`;
      }


      bubble.innerHTML += html;
      bubble.appendChild(menu_button);
      bubble.appendChild(dropDownMenu);

      container.appendChild(icon);
      container.appendChild(bubble);

      const timeLabel = document.createElement('span');
      timeLabel.className = type;
      timeLabel.textContent = formatLocalTime(msg.sent_at)

      wrapper.appendChild(aliasLabel);
      wrapper.appendChild(container);
      wrapper.appendChild(timeLabel);

      chatBox.appendChild(wrapper);
	    
	if (type !== 'own') {
  		if (!msg.read_by.includes(userhash)) {
        		sendMsgStatus(chatId, "read", msg.messageId, userhash);
        		msg.read_by.push(userhash);
        		updateMessageStatusLocal(chatId, msg.messageId, userhash, "read");
		}

	}
		 
    });
  
  if (!newMsgs) {
    chatBox.scrollTop = chatBox.scrollHeight;
  } else {
    const newHeight = chatBox.scrollHeight;
    chatBox.scrollTop = oldScrollTop + (newHeight - oldHeight);
  }
}

function updateMessageStatusLocal(chatId, msgId, userHash, type) {
    if (!chatMessages[chatId] || !chatMessages[chatId].messages) return;

    const messages = chatMessages[chatId].messages;
    const key = chatMessages[chatId].chatPrint;

    for (let i = 0; i < messages.length; i++) {
        let decrypted = JSON.parse(decryptMessage(messages[i], key));
        if (decrypted.messageId === msgId) {
            if (type === "read") {
                decrypted.read_by = decrypted.read_by || [];
                if (!decrypted.read_by.includes(userHash)) {
                    decrypted.read_by.push(userHash);
                }
            } else if (type === "delivered") {
                decrypted.delivered_to = decrypted.delivered_to || [];
                if (!decrypted.delivered_to.includes(userHash)) {
                    decrypted.delivered_to.push(userHash);
                }
            }
            messages[i] = encryptMessage(JSON.stringify(decrypted), key);
            break;
        }
    }
  }

/************************ WEBSOCKET ***********************/

// WebSocket secure connection setup
let socket = new WebSocket("wss://websocket-p1g1.onrender.com"); // use wss for security
let statusTimeout;
let currentFingerprint = crypto.randomUUID();
let currentIdentityHash = null;

// Util to send actions to the WebSocket server
function sendWS(actionType, payload = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket is not open.");
    return;
  }

  const data = {
    action_type: actionType,
    identity_hash: currentIdentityHash,
    fingerprint: currentFingerprint,
    payload: payload,
    timestamp: Date.now()
  };

  socket.send(JSON.stringify(data));
}

// Call this to open a chat session
function joinSocketSession(identityHash) {
  currentIdentityHash = identityHash;
  sendWS("socket_session_joined");
}

function joinedSessionTable(identityHash, rowData) {
  currentIdentityHash = identityHash;
  sendWS("table_session_joined", {
    tableRow: rowData
  });
}

function leaveActiveChat(sender_hash) {
  sendWS("leave_active_chat", {
    sender: sender_hash
  });
}

function sendUpdatedMessage(action, id, content) {
  sendWS("update_message", {
    action: action, messageId: id, message: content
  });
}

function sendMessage(content) {
  sendWS("send_message", {
    message: content
  });
}

function typing(status) {
  sendWS("typing", {
    isTyping: status
  });
}

function lastSeen() {
  sendWS("last_seen", {
    seenAt: Date.now()
  });
}

function editing(status) {
  sendWS("editing", {
    isEditing: status
  });
}

function messageStatusUpdate(type, id, user_hash) {
  sendWS("message_status_update", {
    type: type, messageId: id, userHash: user_hash
  });
}

function userExit() {
  sendWS("user_exit");
}

// Handle incoming messages from the WebSocket server
socket.onmessage = function (event) {
  try {
    const msg = JSON.parse(event.data);
    console.log("Received:", msg);

    switch (msg.action_type) {
      case "socket_session_joined":
        isOnline(true, msg.identity_hash);
        //console.log("Another user joined:", msg.payload.fingerprint);
        break;
      case "table_session_joined":
        handleJoinedSessionTable(msg.payload.tableRow);
        notifyMessage(msg.fingerprint);
        console.log("Another user joined chat:", msg.payload.tableRow);
        break;
      case "leave_active_chat":
        countdownTimers[msg.identity_hash] = {
          timeCount: 300,
          userHash: msg.payload.sender
        };
        //console.log("User left chat:", msg.payload.sender);
        break;
      case "send_message":
        isOnline(true, msg.identity_hash);
        handleSentMessage(msg.identity_hash, msg.payload.message);
        notifyMessage(msg.fingerprint);
        //console.log("New message:", msg.payload.message);
        break;
      case "update_message":
        isOnline(true, msg.identity_hash);
        handleUpdatedMessage(msg.identity_hash, msg.payload.action, msg.payload.messageId, msg.payload.message);
        notifyMessage(msg.fingerprint);
        //console.log("Update message:", msg.payload.messageId);
        break;
      case "typing":
        handleTypingOrEditing("typing", msg.identity_hash);
        //console.log("Someone is typing...");
        break;
      case "last_seen":
        isOnline(false, msg.identity_hash, formatLastSeen(msg.identity_hash, msg.payload.seenAt));
        //console.log("Last seen update:", msg.payload.seenAt);
        break;
      case "editing":
        handleTypingOrEditing("editing", msg.identity_hash);
        //console.log("User is editing a message");
        break;
      case "message_status_update":
        handleMessageStatusUpdate(msg.identity_hash, msg.payload.messageId, msg.payload.userHash, msg.payload.type);
        //console.log("Message status updated");
        break;
      case "expire_warning":
        alert(`Chat: ${msg.identity_hash} will be locked permanently due to inactivity. Chat locks in ${msg.payload.timeLeft} seconds`);
        //console.log("Session warning", msg.identity_hash);
        break;
      case "expire_exit":
        exitChat(msg.identity_hash);
        userExit();
        //console.log("Session expired", msg.identity_hash);
        break;
      default:
        console.log("Unhandled action:", msg);
      }
    } catch (e) {
      console.error("Invalid message:", e);
      alert(e);
    }
  };

  // WebSocket connection open handler
  socket.onopen = function () {
    console.log("WebSocket connected");
    // Join the session when connected
  };

  // WebSocket error handler with automatic reconnection logic
  socket.onerror = function (e) {
    console.error("WebSocket error:", e);
    attemptReconnect();
  };

  // WebSocket closed handler
  socket.onclose = function () {
    console.log("WebSocket disconnected");
  };

  // Attempt reconnection with a delay if WebSocket is closed or an error occurs
	function connectSocket() {
		socket = new WebSocket("wss://websocket-p1g1.onrender.com");
		socket.onopen = onOpenHandler;
		socket.onmessage = onMessageHandler;
		socket.onclose = onCloseHandler;
		socket.onerror = onErrorHandler;
	}

	function attemptReconnect() {
		setTimeout(() => {
			console.log("Reconnecting WebSocket...");
			connectSocket();
		}, 20000);
	}

  // Handle received message and add it to the chat
  function handleSentMessage(id_hash, response) {
    const sentMsg = JSON.parse(response);
    const userHash = chatMessages[id_hash].userHash;
    if (Array.isArray(sentMsg) && sentMsg.length > 0) {
      chatMessages[id_hash].messages.push(...sentMsg);
      chatMessages[id_hash].lastMessageId = sentMsg[sentMsg.length - 1].messageId;

      const key = chatMessages[id_hash].chatPrint;

      for (const encryptedMsg of sentMsg) {
        const decrypted = JSON.parse(decryptMessage(encryptedMsg, key));
        if (userHash != decrypted.sender_hash) {
          markAllAsDelivered(id_hash);
        }
      }
    }

    if (id_hash === currentIdentity) populateChatBubbles(currentIdentity, 1);
  }

  function handleUpdatedMessage(id_hash, action, msgId, newContent) {
    if (!chatMessages[id_hash] || !chatMessages[id_hash].messages) return;

    const messages = chatMessages[id_hash].messages;
    const key = chatMessages[id_hash].chatPrint;

    for (let i = 0; i < messages.length; i++) {
      let decryptedMessage = JSON.parse(decryptMessage(messages[i], key));

      if (decryptedMessage.messageId === msgId) {
        switch (action) {
        case "edit":
          decryptedMessage.message_content = newContent;
          decryptedMessage.is_edited = 1;
          break;
        case "delete":
          decryptedMessage.message_content = newContent;
          decryptedMessage.is_deleted = 1;
          break;
        default:
          return;
        }

        messages[i] = encryptMessage(JSON.stringify(decryptedMessage), key);
        break;
      }
    }

    if (id_hash === currentIdentity) populateChatBubbles(currentIdentity, 1);
  }

function handleMessageStatusUpdate(id_hash, msgId, userHash, type) {
  if (!chatMessages[id_hash] || !chatMessages[id_hash].messages) return;

  const messages = chatMessages[id_hash].messages;
  const key = chatMessages[id_hash].chatPrint;

  let targetIndex = -1;

  // First: find the index of the target messageId
  for (let i = 0; i < messages.length; i++) {
    const decrypted = JSON.parse(decryptMessage(messages[i], key));
    if (decrypted.messageId === msgId) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) return; // Message not found

  // Second: go back from 0 to targetIndex and update messages
  for (let i = 0; i <= targetIndex; i++) {
    let decrypted = JSON.parse(decryptMessage(messages[i], key));
    let updated = false;

    decrypted.delivered_to = decrypted.delivered_to || [];
    decrypted.read_by = decrypted.read_by || [];

    if (type === "delivered") {
      if (!decrypted.delivered_to.includes(userHash)) {
        decrypted.delivered_to.push(userHash);
        updated = true;
      }
    } else if (type === "read") {
      if (
        decrypted.delivered_to.includes(userHash) &&
        !decrypted.read_by.includes(userHash)
      ) {
        decrypted.read_by.push(userHash);
        updated = true;
      }
    }

    if (updated) {
      messages[i] = encryptMessage(JSON.stringify(decrypted), key);
    }
  }

  if (id_hash === currentIdentity) {
    updateTickDisplay(msgId, id_hash);
  }
}

function markAllAsDelivered(chatId) {
  const chatData = chatMessages[chatId];
  if (!chatData || !chatData.messages) return;

  const userHash = chatData.userHash;
  const key = chatData.chatPrint;

  chatData.messages.forEach((encryptedMsg, index) => {
    let msg = JSON.parse(decryptMessage(encryptedMsg, key));

    if (msg.sender_hash === userHash) return;

    msg.delivered_to = msg.delivered_to || [];

    if (!msg.delivered_to.includes(userHash)) {
      sendMsgStatus(chatId, "delivered", msg.messageId, userHash);
      updateMessageStatusLocal(chatId, msg.messageId, userHash, "delivered");
    }
  });
}

  function updateTickDisplay(messageId, chatId) {
    if (!messageId || !chatId || !chatMessages[chatId]) return;

    const messages = chatMessages[chatId].messages;
    const wrapper = document.getElementById(`message-${messageId}`);
    if (!wrapper) return;

    const bubble = wrapper.querySelector('.ownBubble');
    if (!bubble) return;

    const total = chatMessages[chatId].totalUsers - 1;

    // Find the original message and decrypt it
    const rawMsg = messages.find(m => {
      try {
        const decrypted = JSON.parse(decryptMessage(m, chatMessages[chatId].chatPrint).trim());
        return decrypted.messageId === messageId;
      } catch (e) {
        return false;
      }
    });

    if (!rawMsg) return;

    const msg = JSON.parse(decryptMessage(rawMsg, chatMessages[chatId].chatPrint).trim());
    const delivered = msg.delivered_to?.length || 0;
    const read = msg.read_by?.length || 0;

    let newHtml = '';
    let tick = '';
    let countText = '';

    if (read >= total) {
      tick = `<span class="tickStatus tick-read">✓✓</span>`;
    } else if (delivered >= total) {
      tick = `<span class="tickStatus">✓✓</span>`;
    } else if (delivered > 0) {
      tick = `<span class="tickStatus">✓✓</span>`;
      countText = `<span class="tickCount"> ${delivered}/${total}</span>`;
    } else {
      tick = `<span class="tickStatus">✓</span>`;
    }

    if (total > 1 && (read < total || delivered < total)) {
      countText = `<span class="tickCount"> ${Math.max(read, delivered)}/${total}</span>`;
    }

    newHtml = `${tick}${countText}`;

    // Replace existing tick indicators only if changed
    const existingTicks = bubble.querySelectorAll('.tickStatus, .tickCount');
    let currentHtml = '';
    existingTicks.forEach(el => currentHtml += el.outerHTML);

    if (newHtml !== currentHtml) {
      existingTicks.forEach(el => el.remove()); // Remove old ticks
      bubble.insertAdjacentHTML('beforeend', newHtml); // Insert updated ticks
    }
    //alert(newHtml);
  }

  function handleTypingOrEditing(action, id_hash) {
    const activityElement = document.getElementById("header-user-activity");
    clearTimeout(statusTimeout);
    if (id_hash === currentIdentity) activityElement.innerText = action;

    statusTimeout = setTimeout(() => {
      if (id_hash === currentIdentity) activityElement.innerText = "online";
      chatMessages[id_hash].lastSeen = "online";
    },
      2000);
  }

  function handleJoinedSessionTable(response) {
    updateTable(JSON.parse(response));
  }

  function isOnline(status, id_hash, lastSeen = "") {
    const activityElement = document.getElementById("header-user-activity");
    if (status) {
      if (id_hash === currentIdentity) activityElement.innerText = "online";
      chatMessages[id_hash].lastSeen = "online";
    } else {
      if (id_hash === currentIdentity) activityElement.innerText = "Last seen: " + lastSeen;
    }
  }

  function updateLastSeen(id_hash) {
    const lastSeen = chatMessages[id_hash]?.lastSeen;
    if (lastSeen === "online") {
      document.getElementById("header-user-activity").innerText = "online";
    } else if (lastSeen === "editing" || lastSeen === "typing") {
      return;
    } else if (lastSeen) {
      isOnline(false, id_hash, formatLastSeen(id_hash, lastSeen));
    }
  }

  function formatLastSeen(id_hash, timestamp) {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);

    if (chatMessages[id_hash]) {
      chatMessages[id_hash].lastSeen = timestamp;
    }

    if (diff < 120) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hour(s) ago`;
  }

  function sendMsgStatus(identity, type, messageId, userhash) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "messaging.php", true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
		if(xhr.responseText.trim() == "success"){
			messageStatusUpdate(type, messageId, userhash);
		}
	}
      }
    };
    xhr.send("action="+type+"&messageId="+ messageId +"&identity=" + encodeURIComponent(identity));
  }

  function notifyMessage(fingerprint) {
    if (isMute || currentFingerprint === fingerprint) return;

    if (vibrate) {
      if (navigator.vibrate) {
        navigator.vibrate([80]);
      }
    }

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.02;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  function startCountdown() {
    setInterval(() => {
      if (Object.keys(countdownTimers).length > 0) {
        for (const identity_hash in countdownTimers) {
          if (countdownTimers.hasOwnProperty(identity_hash)) {
            countdownTimers[identity_hash].timeCount--;
            if (currentIdentity === identity_hash) {
              const timerEl = document.getElementById("session-timer");
              document.getElementById("timer-box").style.display = "block";
              timerEl.innerText = `${countdownTimers[identity_hash].timeCount}s`;
            } else {
              document.getElementById("timer-box").style.display = "none";
            }

            if (countdownTimers[identity_hash].timeCount <= 0) {
              if (currentIdentity === identity_hash) document.getElementById("timer-box").style.display = "none";
              onCountdownExpired(identity_hash);
              delete countdownTimers[identity_hash];
            }
          }
        }
      }
    },
      1000);
  }

  function onCountdownExpired(identity_hash) {
    let chat_type = chatMessages[identity_hash].chatType;
    if (chat_type === "Pair") {
      lockChat(identity_hash);
      if (currentIdentity === identity_hash) document.getElementById("chat-box-back-btn").click();
    } else if (chat_type === "Group") {
      //addSystemMessage(msg.identity_hash, `A user has left the group.`);
      if (!chatMessages[identity_hash]) return;
      chatMessages[identity_hash].messages = chatMessages[identity_hash].messages.filter(
        msg => msg.sender_hash !== countdownTimers[identity_hash].userHash
      );
      chatBox.innerHTML = "";
      if (currentIdentity === identity_hash) populateChatBubbles(currentIdentity);
    }
    console.log(`Timer expired for ${identity_hash}`);
  }

  function lockChat(id_hash) {
    const tableBody = document.getElementById('table-body');

    const rows = tableBody.rows;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const idcellContent = row.cells[0].textContent;

      if (idcellContent === id_hash) {
        tableBody.deleteRow(i);
      }
    }

    const element = document.querySelector(`.chat-item[data-identity="${id_hash}"]`);
    if (element) {
      element.remove();
    }

    if (chatMessages[id_hash].chatType === "Pair") {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "dashboard.php", true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {}
      };
      xhr.send('delete_row=true&identity=' + id_hash + "&sender_hash=" + chatMessages[id_hash].userHash);
    }

    delete chatMessages[id_hash];
  }

  function removeUserFromSession(id_hash, userHash) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "dashboard.php", true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {}
    };
    xhr.send('delete_row=true&identity=' + id_hash + '&chat_type=group&sender_hash=' + userHash);
  }
  /*
		function addSystemMessage(chat_identity, content) {
			messages[chat_identity] = messages[chat_identity] || [];
			messages[chat_identity].push({
			  sender_id: "system",
			  content,
			  timestamp: Date.now(),
			  type: "system"
			});
			renderChat(chat_identity);
		  }
	*/
  /************************ WEBSOCKET END ***********************/


  const messageForm = document.getElementById('message-form');
  const messagesDiv = document.getElementById('messages');
  const chatCodeSpan = document.getElementById('chat-code');
  const userCountSpan = document.getElementById('user-count');
  const join_btn = document.getElementById('join-btn');
  const chatBox = document.getElementById('chatBox');

  function get_csrf_token() {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", "auth.php", true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        document.getElementById('csrf_token_input').value = xhr.responseText.trim();
      }
    };
    xhr.send('action=get_token');

  }

  function clear_form() {
    document.getElementById('csrf_token_input').value = "";
    document.getElementById('chat_code').value = "";
    document.getElementById('session_code').value = "";
    document.getElementById('total_users').value = "";
    document.getElementById('chat_type').value = "";
  }
  function getTable() {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", "dashboard.php", true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          var result = JSON.parse(xhr.responseText.trim());
          fillTable(result);
        } catch (e) {
          alert(e);
        }
      }
    };
    xhr.send('existing=true');
  }

  function fillTable(sessions) {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = ''; // optional: clear previous rows

    sessions.forEach(session => {
      const newRow = tableBody.insertRow();

      const idcell = newRow.insertCell(0);
      idcell.textContent = session.identity;
      idcell.className = "hidden";

      newRow.insertCell(1).textContent = session.name;

      const statuscell = newRow.insertCell(2);
      statuscell.textContent = session.status;
      statuscell.className = session.status === "pending" ? "pending-status": "active-status";

      newRow.insertCell(3).textContent = session.type;
      newRow.insertCell(4).textContent = session.connected;
      newRow.insertCell(5).textContent = session.time_left;
      newRow.insertCell(6).textContent = session.chat_code;
    });
  }

  function sendSessionData() {
    const csrf_token = document.getElementById('csrf_token_input').value
    const chat_code = document.getElementById('chat_code').value;
    const session_code = document.getElementById('session_code').value;
    const total_users = document.getElementById('total_users').value;
    const chat_type = document.getElementById('chat_type').value;
    const xhr = new XMLHttpRequest();

    if ((chat_code.length < 8 || chat_code.length > 52) || (session_code.length < 8 || session_code.length > 52)) {
      alert("Code length must be at least 8 characters and not more than 52");
      return;
    }

    document.querySelectorAll('.chat-form').forEach(el => el.classList.add('hidden'));

    xhr.open("POST", "dashboard.php", true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          var result = JSON.parse(xhr.responseText.trim());
          const {
            identity
          } = result[0];
          joinedSessionTable(identity + "-table", xhr.responseText.trim());
        } catch (e) {
          if (xhr.responseText.trim().length > 500) {
            alert("Session expired, refresh page to continue.");
          } else {
            alert(xhr.responseText.trim());
          }
        }
      }
    };
    xhr.send('chat_form=true&chat_code=' + chat_code + '&csrf_token='+ csrf_token +'&session_code=' + session_code + '&total_users=' + total_users + '&chat_type=' + chat_type);

  }

  function updateTable(sessions) {
    const tableBody = document.getElementById('table-body');
    sessions.forEach(session => {
      const rows = tableBody.rows;
      let found = false;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const idcellContent = row.cells[0].textContent;

        if (idcellContent === session.identity) {
          tableBody.deleteRow(i);
          const newRow = tableBody.insertRow(i);

          const idcell = newRow.insertCell(0);
          idcell.textContent = session.identity;
          idcell.className = "hidden";

          newRow.insertCell(1).textContent = session.name;

          const statuscell = newRow.insertCell(2);
          statuscell.textContent = session.status;
          if (session.status === "pending") {
            statuscell.className = "pending-status";
          } else {
            statuscell.className = "active-status";
          }


          newRow.insertCell(3).textContent = session.type;
          newRow.insertCell(4).textContent = session.connected;
          newRow.insertCell(5).textContent = session.time_left;
          newRow.insertCell(6).textContent = session.chat_code;

          document.getElementById("sessions-not").innerText = ++new_session;
          found = true;
          break;

        }
      }

      if (!found) {
        const newRow = tableBody.insertRow();

        const idcell = newRow.insertCell(0);
        idcell.textContent = session.identity;
        idcell.className = "hidden";
        newRow.insertCell(1).textContent = session.name;

        const statuscell = newRow.insertCell(2);
        statuscell.textContent = session.status;
        if (session.status === "pending") {
          statuscell.className = "pending-status";
        } else {
          statuscell.className = "active-status";
        }
        newRow.insertCell(3).textContent = session.type;
        newRow.insertCell(4).textContent = session.connected;
        newRow.insertCell(5).textContent = session.time_left;
        newRow.insertCell(6).textContent = session.chat_code;

        document.getElementById("sessions-not").innerText = ++new_session;
      }

    });

  }

  function updateTimeLeft() {
    const tableBody = document.getElementById('table-body');
    const rows = tableBody.rows;
    let found = false;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const timeLeftCell = row.cells[5];
      const status = row.cells[2].textContent;
      let timeLeft = parseInt(timeLeftCell.textContent);

      if (!isNaN(timeLeft) && timeLeft > 0 && status === "pending") {
        timeLeft--;
        timeLeftCell.textContent = timeLeft;
      } else if (!isNaN(timeLeft) && timeLeft === 0) {
        const statuscell = row.cells[2];
        statuscell.textContent = "expired";;
        statuscell.className = "expired-status";
      }
    }
  }


  join_btn.addEventListener('click', (e) => {
    e.preventDefault();
    sendSessionData();
    clear_form();
  });

  function loadActiveChats() {
    const tableBody = document.getElementById('table-body');
    const activeChatsContainer = document.getElementById('active-chats-list');

    const rows = tableBody.rows;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const idcellContent = row.cells[0].textContent;
      const nameCellContent = row.cells[1].textContent;
      const statusCellContent = row.cells[2].textContent;
      const typeCellContent = row.cells[3].textContent;
      const connectedCellContent = row.cells[4].textContent;
      const codeCellContent = row.cells[6].textContent;

      if (statusCellContent == "active" && !activeChatsContainer.querySelector(`li[data-identity="${idcellContent}"]`)) {
        const chatItem = document.createElement('li');
        chatItem.classList.add('chat-item');
        chatItem.setAttribute('data-identity', idcellContent);

        chatItem.innerHTML = `
        <span class="chat-name">${row.cells[1].textContent}</span>
        <span class="chat-type">${row.cells[3].textContent}</span>
        <button class="enter-chat">Enter</button>
        `;

        activeChatsContainer.appendChild(chatItem);
        document.getElementById("active-not").innerText = ++new_chats;
        chatItem.querySelector('.enter-chat').addEventListener('click', function () {
          openChatScreen(idcellContent, nameCellContent, typeCellContent, codeCellContent, connectedCellContent);
        });
      }
    }

  }

  document.getElementById("mobile-tabs").addEventListener("click", function (e) {
    if (e.target.tagName === "BUTTON") {
      const tabId = e.target.id.split("-")[1];
      showTab(tabId);
    }
  });

  function showTab(tabId) {
    const tabs = ['left', 'center', 'right'];

    tabs.forEach(id => {
      document.getElementById(`tab-${id}`).classList.toggle('active', id === tabId);
      document.getElementById(id === 'left' ? 'left': id === 'center' ? 'form-inputs': 'session-table').style.display = id === tabId ? 'block': 'none';

    });
    if (tabId === "right") {
      new_session = "";
      document.getElementById("sessions-not").innerText = new_session;
    } else if (tabId === "left") {
      new_chats = "";
      document.getElementById("active-not").innerText = new_chats;
    }
  }

  let isMobileView = window.innerWidth < 768;

function applyResponsiveLayout() {
  if (isMobileView) {
    // Mobile view
    showTab('center');
    new_session = "";
    new_chats = "";
    document.getElementById("active-not").innerText = new_chats;
    document.getElementById("sessions-not").innerText = new_session;

    if (currentIdentity) {
      document.getElementById('form-inputs').style.display = 'none';
    } else {
      document.getElementById("mobile-tabs").style.display = 'block';
    }

  } else {
    // Desktop view
    ['left', 'form-inputs', 'session-table'].forEach(id => {
      document.getElementById(id).style.display = 'block';
    });
    document.getElementById("mobile-tabs").style.display = 'none';
  }
}

// On load
window.addEventListener('load', () => {
  applyResponsiveLayout();
});

// On resize — only if view state changes
window.addEventListener('resize', () => {
  const nowMobile = window.innerWidth < 768;
  if (nowMobile !== isMobileView) {
    isMobileView = nowMobile;
    applyResponsiveLayout();
  }
});

  function openChatScreen(identity, name, chat_type, code, users) {
    // Hide non-chat UI elements
    ["mobile-tabs", "form-inputs", "session-table", "footer", "header"].forEach(id =>
      document.getElementById(id).style.display = 'none'
    );

    // Show the chat box and adjust mobile layout
    document.getElementById("main-chat-box").style.display = 'block';
    if (window.innerWidth < 768) document.getElementById("left").style.display = 'none';

    // Set the current chat details and join session
    currentIdentity = identity;
    currentTotalUsers = users.split("/")[0];
    document.getElementById("header-chat-name").innerText = name;
    document.getElementById("avatar").innerText = name.charAt(0);
    document.getElementById("header-chat-code").innerText = code;
    chatBox.innerHTML = "";
    joinSocketSession(currentIdentity);
    
    // Set the last seen status
    updateLastSeen(currentIdentity);
    const muteEl = document.getElementById("toggleMute");
    muteEl.innerHTML = isMute ? "&#128263;": "&#128266;";

    getMessages(chat_type);
  }

  document.getElementById("leave-chat-btn").addEventListener('click', () => {
    if (confirm("Do you really want to leave? You will not be able to access the chats unless both parties connect again")) {
      exitChat(currentIdentity);
    }

  });

  function exitChat(id_hash) {
    leaveActiveChat(chatMessages[id_hash].userHash);
    document.getElementById("timer-box").style.display = "none";

    if (chatMessages[id_hash].chatType === "Group") {
      removeUserFromSession(id_hash, chatMessages[id_hash].userHash);
    }
    lockChat(id_hash);
    document.getElementById("chat-box-back-btn").click();
  }

  document.getElementById("chat-box-back-btn").addEventListener('click', () => {
    // Restore the UI and update the last seen status
    ["mobile-tabs", "form-inputs", "session-table", "footer", "header"].forEach(id =>
      document.getElementById(id).style.display = 'block'
    );
    document.getElementById("main-chat-box").style.display = 'none';

    if (window.innerWidth < 768) {
      showTab('center');
      new_session = ""; new_chats = "";
      document.getElementById("active-not").innerText = new_chats;
      document.getElementById("sessions-not").innerText = new_session;
    } else {
      ['left',
        'form-inputs',
        'session-table'].forEach(id => document.getElementById(id).style.display = 'block');
      document.getElementById("mobile-tabs").style.display = 'none';
    }

    if (chatMessages[currentIdentity]) lastSeen();
    currentIdentity = "";
    chatBox.innerHTML = "";
  });

  document.getElementById("attach-btn").addEventListener('click', () => {
    const menu = document.getElementById("attachMenu");
    menu.style.display = menu.style.display === "block" ? "none": "block";
  });

  document.getElementById("attachMenu").addEventListener('click', (e) => {
    const menu = document.getElementById("attachMenu");
    menu.style.display = menu.style.display === "block" ? "none": "block";

    switch (e.target.id) {
    case "attach-btn-image":
      document.getElementById("imageInput").click();
      break;
    case "attach-btn-video":
      document.getElementById("videoInput").click();
      break;
    case "attach-btn-document":
      document.getElementById("documentInput").click();
      break;
    default:
      break;
    }
  });

  function getMessages(chat_type, limit = 50, offset = 0) {
    if (chatMessages[currentIdentity]) {
      markAllAsDelivered(currentIdentity);
      populateChatBubbles(currentIdentity);   
      return;
    }

    if (!currentChatUserHash) {
      getChatUserHash(currentIdentity, function (userHash) {
        currentChatUserHash = userHash;
      });
    }

    if (!currentChatPrint) {
      getChatPrint(currentIdentity, function (chatPrint) {
        currentChatPrint = chatPrint;
      });
    }

    if (Object.keys(aliasMap).length === 0) {
      fetchAliasMapXHR(currentIdentity, function (map) {
        aliasMap = map;
      });
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "messaging.php", true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200 && xhr.responseText.trim() !== "failed") {
        try {
          const response = JSON.parse(xhr.responseText.trim());
          if (Array.isArray(response)) {
            chatMessages[currentIdentity] = {
              messages: response,
              lastMessageId: response[response.length - 1].messageId,
              userHash: currentChatUserHash,
              chatType: chat_type,
              lastSeen: "online",
              aliasMap: aliasMap,
              chatPrint: currentChatPrint,
              totalUsers: currentTotalUsers
            };
            currentChatUserHash = null;
            aliasMap = {};
            currentChatPrint = null;
          }
		
	  markAllAsDelivered(currentIdentity);
          populateChatBubbles(currentIdentity);
        } catch (e) {
          alert('Failed to load messages');
        }
      } else if (xhr.responseText.trim() === "failed") {
        if (!chatMessages[currentIdentity]) {
          chatMessages[currentIdentity] = {
            messages: [],
            lastMessageId: 0,
            userHash: currentChatUserHash,
            chatType: chat_type,
            lastSeen: "online",
            aliasMap: aliasMap,
            chatPrint: currentChatPrint,
            totalUsers: currentTotalUsers
          };
          currentChatUserHash = null;
          aliasMap = {};
          currentChatPrint = null;
          currentTotalUsers = null;
        }
      }

    };
    xhr.send(`action=get&identity=${currentIdentity}&limit=${limit}&offset=${offset}`);
  }

  function fetchAliasMapXHR(identity, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "messaging.php", true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            const aliasMap = JSON.parse(xhr.responseText.trim());
            callback(aliasMap);
          } catch (e) {
            console.error("Failed to parse alias map:", e);
            callback( {});
          }
        } else {
          console.error("XHR error:", xhr.status);
          callback( {});
        }
      }
    };

    xhr.send("fetch=get_alias_map&identity=" + encodeURIComponent(identity));
  }


  function getChatUserHash(identity, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "messaging.php", true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          const userHash = xhr.responseText.trim();
          callback(userHash);
        } else {
          console.error("XHR error:", xhr.status);
          callback( {});
        }
      }
    };

    xhr.send("action=get_hash&identity=" + encodeURIComponent(identity));
  }

  function getChatPrint(identity, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "messaging.php", true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          const chatPrint = xhr.responseText.trim();
          callback(chatPrint);
        } else {
          console.error("XHR error:", xhr.status);
          callback( {});
        }
      }
    };

    xhr.send("action=get_print&identity=" + encodeURIComponent(identity));
  }


  document.getElementById("send-btn").addEventListener('click', () => {
    const text = document.getElementById("chatInput").value.trim();
    document.getElementById("chatInput").value = "";
    if (!text && selectedFiles.length === 0) return;

    addLoadingBubble(true);
    const formData = new FormData();
    formData.append("message_content", encryptMessage(text, chatMessages[currentIdentity].chatPrint));
    formData.append("message_type", selectedFiles.length > 0 ? "media": "text");
    formData.append("identity", currentIdentity);
    formData.append("reply_to", currentReplyMessageId ? currentReplyMessageId: 0);
    formData.append("action", "send");
    selectedFiles.forEach(file => {
      formData.append("media_files[]", file);
    });


    const xhr = new XMLHttpRequest();
    xhr.open("POST", "messaging.php", true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        document.getElementById("previewContainer").innerHTML = "";
        selectedFiles = [];
        cancelReply(event);
        sendMessage(xhr.responseText.trim());
      } else {
        alert("Send failed");
        document.getElementById("chatInput").value = text;
        removeLoadingBubble();
      }
    };
    xhr.send(formData);
  });

  document.getElementById("chatInput").addEventListener('input', () => {
    typing(true);

  });

  document.getElementById("edit-input").addEventListener('input', () => {
    editing(true);

  });

  document.getElementById("search-input").addEventListener('input', function () {
    const searchString = this.value.toLowerCase().trim();

    const wrappers = document.querySelectorAll('.bubbleWrapper');

    wrappers.forEach(wrapper => {
      const p = wrapper.querySelector('p');
      if (!p) {
        wrapper.style.display = searchString ? 'none': 'flex';
        return;
      }

      const rawText = p.textContent;
      p.textContent = rawText;
      wrapper.style.display = 'flex';

      if (searchString) {
        if (rawText.toLowerCase().includes(searchString)) {
          const regex = new RegExp(`(${searchString})`, 'gi');
          p.innerHTML = rawText.replace(regex, '<span class="highlight-search">$1</span>');
        } else {
          wrapper.style.display = 'none';
        }
      }
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.matches('.menu-button')) {
      document.querySelectorAll('.dropdown').forEach(el => el.style.display = 'none');
    }
    if (!e.target.matches('.icon-button')) {
      document.getElementById('chatHeaderDropdownMenu').style.display = 'none';
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const form = document.getElementById('chat-input-form');
        if (btn.hash === '#new_pair') {
          document.querySelectorAll('.group-only').forEach(el => el.classList.add('hidden'));
          document.querySelectorAll('.chat-form').forEach(el => el.classList.remove('hidden'));
          clear_form();
          document.getElementById('form-action-label').innerText = "New Pair";
          document.getElementById('chat_type').value = "new_pair";
          get_csrf_token();
        } else if (btn.hash === '#resume_pair') {
          document.querySelectorAll('.group-only').forEach(el => el.classList.add('hidden'));
          document.querySelectorAll('.chat-form').forEach(el => el.classList.remove('hidden'));
          clear_form();
          document.getElementById('form-action-label').innerText = "Resume Pair";
          document.getElementById('chat_type').value = "resume_pair";
          get_csrf_token();
        } else if (btn.hash === '#new_group') {
          document.querySelectorAll('.group-only').forEach(el => el.classList.remove('hidden'));
          document.querySelectorAll('.chat-form').forEach(el => el.classList.remove('hidden'));
          clear_form();
          document.getElementById('form-action-label').innerText = "New Group";
          document.getElementById('chat_type').value = "new_group";
          get_csrf_token();
        } else if (btn.hash === '#resume_group') {
          document.querySelectorAll('.group-only').forEach(el => el.classList.remove('hidden'));
          document.querySelectorAll('.chat-form').forEach(el => el.classList.remove('hidden'));
          clear_form();
          document.getElementById('form-action-label').innerText = "Resume Group";
          document.getElementById('chat_type').value = "resume_group";
          get_csrf_token();
        } else if (btn.hash === '#message_pair') {
          document.querySelectorAll('.pair-chat-options').forEach(el => el.classList.remove('hidden'));
          document.querySelectorAll('.main-chat-options').forEach(el => el.classList.add('hidden'));
        } else if (btn.hash === '#message_group') {
          document.querySelectorAll('.group-chat-options').forEach(el => el.classList.remove('hidden'));
          document.querySelectorAll('.main-chat-options').forEach(el => el.classList.add('hidden'));
        }
      });
    });

    document.querySelectorAll('.join-create-back-btn').forEach(btn => {
      btn.addEventListener('click',
        (e) => {
          document.querySelectorAll('.main-chat-options').forEach(el => el.classList.remove('hidden'));
          document.querySelectorAll('.chat-form').forEach(el => el.classList.add('hidden'));
          document.querySelectorAll('.group-chat-options').forEach(el => el.classList.add('hidden'));
          document.querySelectorAll('.pair-chat-options').forEach(el => el.classList.add('hidden'));
        });
    });

    startCountdown();
    getTable();

    setInterval(() => {
      updateLastSeen(currentIdentity);
    }, 2000);

    setInterval(loadActiveChats, 1000);
    setInterval(updateTimeLeft, 1000);
  });
