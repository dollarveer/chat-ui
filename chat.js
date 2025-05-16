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

	isMute = isMute ? false : true;
	localStorage.setItem('isMute', isMute);
	muteEl.innerHTML = isMute ? "&#128263;" : "&#128266;";
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
	menu.style.display = (menu.style.display === 'flex') ? 'none' : 'flex';
}

function getUnixMsFromServerTime(serverTimestamp) {
const SERVER_OFFSET_MINUTES = -300;
  const serverDate = new Date(serverTimestamp + 'Z');
  return serverDate.getTime() + SERVER_OFFSET_MINUTES * 60 * 1000;
}

function toggleMenu(btn) {
	const dropdown = btn.nextElementSibling;
	dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';

	const bubble = btn.closest('.bubbleWrapper');
	const timestamp = getUnixMsFromServerTime(bubble.dataset.timestamp);
	const now = Date().now();
	const DELETE_TIMEOUT = 2 * 60 * 60 * 1000;
	const EDIT_TIMEOUT = 45 * 60 * 1000;
	const timeDiff = now - timestamp;
	const isSender = bubble.classList.contains("own");

	if (isSender) {
		dropdown.querySelector('.edit-btn').style.display = timeDiff <= EDIT_TIMEOUT ? 'block' : 'none';
		dropdown.querySelector('.delete-btn').style.display = timeDiff <= DELETE_TIMEOUT ? 'block' : 'none';
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
	document.getElementById('reply-preview').setAttribute('data-reply-id', id);

	document.getElementById('edit-preview').style.display = 'none';
}

function scrollToOriginalMessage(id = document.getElementById("reply-preview").getAttribute("data-reply-id")) {
	const messageId = id;
	const target = document.getElementById(`message-${messageId}`);

	if (target) {
		target.scrollIntoView({ behavior: "smooth", block: "center" });
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
	const updatedText = document.getElementById("edit-input").value;

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
				if (chatMessages[currentIdentity]) {
					const msg = chatMessages[currentIdentity].messages.find(m => m.messageId === currentEditMessageId);
					if (msg) {
						msg.is_edited = 1;
						msg.message_content = updatedText;
					}
				}
				const messageElement = document.getElementById(`message-text-${currentEditMessageId}`);

				const bubble = document.getElementById(`message-${currentEditMessageId}`);
				if (bubble.querySelector('.edited-label')) bubble.querySelector('.edited-label').remove();

				messageElement.innerText = updatedText;
				const editedSpan = document.createElement('span');
				editedSpan.className = 'edited-label';
				editedSpan.innerText = ' (edited)';
				messageElement.insertAdjacentElement('afterend', editedSpan);

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
					if (chatMessages[currentIdentity]) {
						const msg = chatMessages[currentIdentity].messages.find(m => m.messageId === messageId);
						if (msg) {
							msg.is_deleted = 1;
							msg.message_content = "This message was deleted.";
						}

						document.getElementById('message-text-' + messageId).innerText = "";
						bubble.innerText = "This message was deleted.";
						bubble.classList.add("deleted-message");

						alert("Deleted");
					}
				}
			} catch (e) {

			}
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

function formatLocalTime(serverTimestamp, serverZone = 'America/New_York') {
  const { DateTime } = luxon;

  // Step 1: Parse the server timestamp as server time
  const serverDate = DateTime.fromFormat(serverTimestamp, 'yyyy-MM-dd HH:mm:ss', {
    zone: serverZone
  });

  // Step 2: Convert to the browser’s detected offset
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDate = serverDate.setZone(localZone);

  // Step 3: Return clean local string
  return localDate.toLocaleString(DateTime.DATETIME_MED); // or TIME_SIMPLE
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


function populateChatBubbles(chatId, newMsgs = 0) {
	const chatBox = document.getElementById("chatBox");
	if (!chatId || !chatBox) return;

	const msgs = chatMessages[chatId].messages;
	const userhash = chatMessages[chatId].userHash;
	const aliasMap = chatMessages[chatId].aliasMap;
	const chatType = chatMessages[chatId].chatType;
	const chatPrint = chatMessages[chatId].chatPrint;

	if (!msgs || msgs.length === 0) return;

	msgs.forEach(msg => {
		const alias = renderAlias(msg.sender_hash, userhash, aliasMap, chatType);
		if (chatType === "Group" && alias === false) return;
		if (document.getElementById(`message-${msg.messageId}`)) return;

		const type = msg.sender_hash === userhash ? 'own' : 'other';

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


		// Deleted message
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
			? 'assets/img/sender.png'
			: 'assets/img/recipient.png';

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

		// Reply preview
		if (msg.reply_to) {

			const replyDiv = document.createElement('div');
			const replyMsg = msgs.find(m => m.messageId === msg.reply_to);

			if (replyMsg) {
				const replyAlias = renderAlias(replyMsg.sender_hash, userhash, aliasMap, chatType);
				if (replyAlias === false && chatType === "Group") return;

				const replyText = replyMsg.message_content ? replyMsg.message_content : '[Original message]';;
				replyDiv.setAttribute("onclick", `scrollToOriginalMessage(${replyMsg.messageId})`);
				replyDiv.setAttribute("style", `font-size:13px;color:#ccc;margin-bottom:5px;margin-right: 20px; border-left:2px solid #aaa;padding-left:8px;`);
				replyDiv.innerHTML = ` ↪ <strong>${replyAlias}:</strong></br> ${decryptMessage(replyText, chatPrint)}`;
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
				const mediaFiles = JSON.parse(msg.media_url);
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
				console.warn("Invalid media JSON for msg:", msg.messageId, e);
			}
		}

		if (type === 'own') {
			switch (msg.status) {
				case 'sent':
					html += `<span class="tickStatus">✓</span>`;
					break;
				case 'delivered':
					html += `<span class="tickStatus">✓✓</span>`;
					break;
				case 'read':
					html += `<span class="tickStatus tick-read">✓✓</span>`;
					break;
			}
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
	});

	if (!newMsgs) {
		chatBox.scrollTop = chatBox.scrollHeight;
	}
}

document.addEventListener('DOMContentLoaded', () => {


	/************************ WEBSOCKET ***********************/

	// WebSocket secure connection setup
	const socket = new WebSocket("wss://websocket-qk4f.onrender.com"); // use wss for security
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
		sendWS("table_session_joined", { tableRow: rowData });
	}

	function leaveActiveChat(sender_hash) {
		sendWS("leave_active_chat", { sender: sender_hash });
	}

	// Call this to send a message
	function sendMessage(content) {
		sendWS("send_message", { message: content });
	}

	// Optional features
	function typing(status) {
		sendWS("typing", { isTyping: status });
	}

	function lastSeen() {
		sendWS("last_seen", { seenAt: Date.now() });
	}

	function editing(status) {
		sendWS("editing", { isEditing: status });
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
					countdownTimers[msg.identity_hash] = { timeCount: 300, userHash: msg.payload.sender };
					//console.log("User left chat:", msg.payload.sender);
					break;
				case "send_message":
					isOnline(true, msg.identity_hash);
					handleSentMessage(msg.identity_hash, msg.payload.message);
					notifyMessage(msg.fingerprint);
					//console.log("New message:", msg.payload.message);
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
	function attemptReconnect() {
		setTimeout(() => {
			console.log("Reconnecting WebSocket...");
			socket = new WebSocket("wss://websocket-qk4f.onrender.com");
		}, 20000); // Retry after 5 seconds
	}

	// Handle received message and add it to the chat
	function handleSentMessage(id_hash, response) {
		const sentMsg = JSON.parse(response);
		if (Array.isArray(sentMsg) && sentMsg.length > 0) {
			chatMessages[id_hash].messages.push(...sentMsg);
			chatMessages[id_hash].lastMessageId = sentMsg[sentMsg.length - 1].messageId;
		}

		if (id_hash === currentIdentity) populateChatBubbles(currentIdentity);
	}

	// Update UI for typing/editing status with timeout
	function handleTypingOrEditing(action, id_hash) {
		const activityElement = document.getElementById("header-user-activity");
		clearTimeout(statusTimeout);
		if (id_hash === currentIdentity) activityElement.innerText = action;

		statusTimeout = setTimeout(() => {
			if (id_hash === currentIdentity) activityElement.innerText = "online";
			chatMessages[id_hash].lastMessageId = "online";
		}, 2000);
	}

	// Update the chat table session (e.g., when user joins a specific chat group)
	function handleJoinedSessionTable(response) {
		updateTable(JSON.parse(response));
	}

	// Update the user activity status to online or show last seen
	function isOnline(status, id_hash, lastSeen = "") {
		const activityElement = document.getElementById("header-user-activity");
		if (status) {
			if (id_hash === currentIdentity) activityElement.innerText = "online";
			chatMessages[id_hash].lastMessageId = "online";
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

	// Format time ago for last seen status
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
						}else{
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
		}, 1000);
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

	startCountdown()

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
				if (xhr.readyState === 4 && xhr.status === 200) {
				}
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
			if (xhr.readyState === 4 && xhr.status === 200) {
			}
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
		btn.addEventListener('click', (e) => {
			document.querySelectorAll('.main-chat-options').forEach(el => el.classList.remove('hidden'));
			document.querySelectorAll('.chat-form').forEach(el => el.classList.add('hidden'));
			document.querySelectorAll('.group-chat-options').forEach(el => el.classList.add('hidden'));
			document.querySelectorAll('.pair-chat-options').forEach(el => el.classList.add('hidden'));
		});
	});

	function get_csrf_token(){
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

	getTable();


	function fillTable(sessions) {
		const tableBody = document.getElementById('table-body');

		sessions.forEach(innerArray => {
			const session = innerArray[0];
			const newRow = tableBody.insertRow();

			alert(session.chat_code);
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
		});
	}

	function sendSessionData() {
		const csrf_token = document.getElementById('csrf_token_input').value
		const chat_code = document.getElementById('chat_code').value;
		const session_code = document.getElementById('session_code').value;
		const total_users = document.getElementById('total_users').value;
		const chat_type = document.getElementById('chat_type').value;
		const xhr = new XMLHttpRequest();

		document.querySelectorAll('.chat-form').forEach(el => el.classList.add('hidden'));

		xhr.open("POST", "dashboard.php", true);
		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4 && xhr.status === 200) {
				try {
					var result = JSON.parse(xhr.responseText.trim());
					const { identity } = result[0];
					joinedSessionTable(identity + "-table", xhr.responseText.trim());
				} catch (e) {
					alert(xhr.responseText.trim());
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
					openChatScreen(idcellContent, nameCellContent, typeCellContent, codeCellContent);
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
			document.getElementById(id === 'left' ? 'left' : id === 'center' ? 'form-inputs' : 'session-table').style.display = id === tabId ? 'block' : 'none';

		});
		if (tabId === "right") {
			new_session = "";
			document.getElementById("sessions-not").innerText = new_session;
		} else if (tabId === "left") {
			new_chats = "";
			document.getElementById("active-not").innerText = new_chats;
		}
	}

	window.addEventListener('load', () => {
		if (window.innerWidth < 768) {
			showTab('center');
			new_session = ""; new_chats = "";
			document.getElementById("active-not").innerText = new_chats;
			document.getElementById("sessions-not").innerText = new_session;
		} else['left', 'form-inputs', 'session-table'].forEach(id => document.getElementById(id).style.display = 'block');
	});
	window.addEventListener('resize', () => {
		if (window.innerWidth < 768) {
			showTab('center');
			if(currentIdentity){
				document.getElementById('form-inputs').style.display = 'none';
			}else {
				document.getElementById("mobile-tabs").style.display = 'block';
			}
			new_session = ""; new_chats = "";
			document.getElementById("active-not").innerText = new_chats;
			document.getElementById("sessions-not").innerText = new_session;
		} else{
			['left', 'form-inputs', 'session-table'].forEach(id => document.getElementById(id).style.display = 'block');
			document.getElementById("mobile-tabs").style.display = 'none';
		}
	});

	function openChatScreen(identity, name, chat_type, code) {
		// Hide non-chat UI elements
		["mobile-tabs", "form-inputs", "session-table", "footer", "header"].forEach(id =>
			document.getElementById(id).style.display = 'none'
		);

		// Show the chat box and adjust mobile layout
		document.getElementById("main-chat-box").style.display = 'block';
		if (window.innerWidth < 768) document.getElementById("left").style.display = 'none';

		// Set the current chat details and join session
		currentIdentity = identity;
		document.getElementById("header-chat-name").innerText = name;
		document.getElementById("avatar").innerText = name.charAt(0);
		document.getElementById("header-chat-code").innerText = code;
		chatBox.innerHTML = "";
		joinSocketSession(currentIdentity);
		getMessages(chat_type);

		// Set the last seen status
		updateLastSeen(currentIdentity);
		const muteEl = document.getElementById("toggleMute");
		muteEl.innerHTML = isMute ? "&#128263;" : "&#128266;";
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
		} else{
			['left', 'form-inputs', 'session-table'].forEach(id => document.getElementById(id).style.display = 'block');
			document.getElementById("mobile-tabs").style.display = 'none';
		}

		if (chatMessages[currentIdentity]) lastSeen();
		currentIdentity = "";
		chatBox.innerHTML = "";
	});

	document.getElementById("attach-btn").addEventListener('click', () => {
		const menu = document.getElementById("attachMenu");
		menu.style.display = menu.style.display === "block" ? "none" : "block";
	});

	document.getElementById("attachMenu").addEventListener('click', (e) => {
		const menu = document.getElementById("attachMenu");
		menu.style.display = menu.style.display === "block" ? "none" : "block";

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
							chatPrint: currentChatPrint
						};
						currentChatUserHash = null;
						aliasMap = {};
						currentChatPrint = null;
					}
					populateChatBubbles(currentIdentity);
				} catch (e) {
					alert(e + '\n\nFailed to load messages');
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
						chatPrint: currentChatPrint
					};
					currentChatUserHash = null;
					aliasMap = {};
					currentChatPrint = null;
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
						callback({});
					}
				} else {
					console.error("XHR error:", xhr.status);
					callback({});
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
					callback({});
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
					callback({});
				}
			}
		};

		xhr.send("action=get_print&identity=" + encodeURIComponent(identity));
	}


	document.getElementById("send-btn").addEventListener('click', () => {
		const text = document.getElementById("chatInput").value.trim();
		if (!text && selectedFiles.length === 0) return;

		const formData = new FormData();
		formData.append("message_content", encryptMessage(text, chatMessages[currentIdentity].chatPrint));
		formData.append("message_type", selectedFiles.length > 0 ? "media" : "text");
		formData.append("identity", currentIdentity);
		formData.append("reply_to", currentReplyMessageId ? currentReplyMessageId : 0);
		formData.append("action", "send");
		selectedFiles.forEach(file => {
			formData.append("media_files[]", file);
		});


		const xhr = new XMLHttpRequest();
		xhr.open("POST", "messaging.php", true);
		xhr.onload = function () {
			if (xhr.status === 200) {
				document.getElementById("chatInput").value = "";
				document.getElementById("previewContainer").innerHTML = "";
				selectedFiles = [];
				cancelReply(event);
				sendMessage(xhr.responseText.trim());
			} else {
				alert("Send failed");
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
		const searchString = this.value.toLowerCase();
		const bubbles = document.querySelectorAll('.message-bubble');

		bubbles.forEach(bubble => {
			const textElement = bubble.querySelector('p');
			const originalText = textElement.textContent;
			textElement.innerHTML = originalText;
			bubble.style.display = "block";
			if (searchString) {
				const text = originalText.toLowerCase();
				if (text.includes(searchString)) {
					const regex = new RegExp(`(${searchString})`, 'gi');
					textElement.innerHTML = originalText.replace(regex, '<span class="highlight-search">$1</span>')
				} else {
					bubble.style.display = "none";
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

	setInterval(() => {
		updateLastSeen(currentIdentity);
	}, 2000);

	setInterval(loadActiveChats, 1000);
	setInterval(updateTimeLeft, 1000);
});
