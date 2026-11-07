async function loadNotifications(){

const response =
await fetch("/api/notifications");

const data =
await response.json();

const box =
document.getElementById(
"notificationList"
);

box.innerHTML =
data.notifications
.map(item => `
<div class="card">
<h3>${item.title}</h3>
<p>${item.body}</p>
</div>
`)
.join("");

}

loadNotifications();
