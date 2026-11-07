async function load(){

const response =
await fetch(
"/api/leaderboard"
);

const data =
await response.json();

document
.getElementById("leaderboard")
.innerHTML =
data.leaders.map(
user => `
<div>

<b>${user.username}</b>

- ${user.rank_title}

(${user.achievements})

</div>
`
).join("");

}

load();
