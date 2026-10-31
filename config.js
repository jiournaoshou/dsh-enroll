// 后端地址。留空 = 同源（前后端同一个端口时用）。
// 这里填隧道地址：Pages 只发静态页，写库的那台机器通过 cloudflared 暴露。
// 隧道重启后这个域名会变，变了一条命令换回来：
//   py -3.12 web/tunnel.py set https://新的.trycloudflare.com
window.API_BASE = "https://improvement-different-knit-authentic.trycloudflare.com";
