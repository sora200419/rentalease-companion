# Recording card: rule-mode demo, about 2:50

A one-page plan for the take. It follows [DEMO-SCRIPT.md](DEMO-SCRIPT.md) but is
cut to fit under three minutes and assumes **rule mode** (no Amazon Bedrock).
Read the English lines in the middle column out loud while you click. The right
column is only there so you know what you are saying.

Do not say anything that is not on screen. Do not say Bedrock answered: in this
recording the rule assistant answers, and the page says so.

## Before you press record

- [ ] Chrome, exactly `http://127.0.0.1:3030/demo`, microphone allowed. Close other tabs, `.env.local` and the AWS console.
- [ ] Mute any real Alexa device nearby. Your question starts with the word "Alexa".
- [ ] **Start another scenario** → **Standard** → **Confirm new scenario**. Check: **Tenant · Aina**, refund **MYR 1625.00**, **0 / 3** resolved.
- [ ] **Spoken replies on**, volume up. Click once on the page so the browser is allowed to speak.
- [ ] The MCP panel shows a token. Keep it off screen, or blur it afterwards. In the terminal, set `TOKEN=…` before you record and use `Bearer $TOKEN`.
- [ ] Run the Inspector command once beforehand so `npx` has already downloaded it.
- [ ] Rehearse once in a different scenario, then start a fresh scenario for the take.

Message to paste for the landlord's withdrawal:

```
I withdraw this deduction after reviewing the move-in record.
```

## The take

| Time | On screen | Say (English) | 中文意思 |
|---|---|---|---|
| 0:00–0:19 | `/demo`, the **Ask RentalEase** card in view. Add the caption *Simulated Alexa+ experience · browser speech recognition · synthetic data* | "When a tenancy ends, the landlord keeps part of the deposit, and nobody remembers what the flat looked like on day one. RentalEase is a simulated Alexa+ voice experience for tenants and landlords. It answers from the move-in and move-out records, through its own MCP server." | 租约结束时，房东扣一部分押金，没人记得房子第一天的样子。RentalEase 是模拟的 Alexa+ 语音体验，从入住和退房记录里回答，用的是它自己的 MCP 服务器。 |
| 0:20–0:27 | Tap the ring and speak | "Alexa, ask RentalEase whether the scuff was already there when I moved in." | （直接问问题） |
| 0:27–0:50 | Stay silent. The answer is read aloud. Point at the source chips, click one to jump to the report | (nothing, let it play) | （让它自己读完） |
| 0:50–1:03 | Still on the answer | "My browser heard me, not an Alexa device. The rule assistant quotes both reports word for word, and each source chip links to the record. It never says who is right." | 是浏览器听到我，不是 Alexa 设备。规则助手逐字引用两份报告，每个来源标签都链接到记录。它从不判断谁对谁错。 |
| 1:03–1:08 | Tap the ring and speak | "Dispute the wall charge for me." | （说出来） |
| 1:08–1:30 | The dispute form opens pre-filled. Press **Preview decision**, read the preview, press **Confirm and save**. Show the new entry in **Shared decision history** | "It only prepares a draft. I read the preview, then press Confirm and save myself. Nothing is recorded until I do." | 它只准备草稿。我看预览，然后自己按确认保存。我按之前什么都不会被记录。 |
| 1:30–1:55 | Click **Landlord · Daniel**, select **Bedroom wall repainting**, choose **Withdraw this deduction**, paste the message, **Preview decision**, **Confirm and save**. The refund shows **MYR 1725.00** | "Switching roles simulates the landlord. He withdraws the wall charge, and the recorded refund rises by one hundred ringgit. Agreed is not paid: no money moves here." | 切换角色模拟房东。他撤销墙面扣款，记录的退款增加一百令吉。同意不等于付款，这里不转任何钱。 |
| 1:55–2:15 | Click **Tenant · Aina**, select **Kitchen cleaning**, press **Draft a dispute letter**. Scroll the letter so both quoted reports show, press **Copy letter** | "If I would rather write to my landlord, it drafts a letter from the same records. It quotes both reports, asks for evidence, and never says who is liable. Nothing is sent from here." | 如果我想自己写信给房东，它用同样的记录起草一封信。引用两份报告，要求证据，从不说谁该负责。这里不会发送任何东西。 |
| 2:15–2:35 | Scroll to **Connect an MCP client to this case** (token blurred), cut to the terminal and run the Inspector command. Hold on the six tool names | "Other MCP clients can use the same server. With this case's token, MCP Inspector lists the six read-only tools. There is no confirm or payment tool." | 其他 MCP 客户端也能用同一个服务器。用这个案例的 token，MCP Inspector 列出六个只读工具。没有确认或付款工具。 |
| 2:35–2:50 | Back to the page header and the simulation note | "This builds on my RentalEase final-year project. Voice, the MCP server and multi-item resolution are new for the hackathon. Optional Amazon Bedrock support is built in, but this recording uses the rule assistant." | 这个项目建立在我的 RentalEase 毕业项目上。语音、MCP 服务器和多项扣款处理是为黑客松新做的。可选的 Amazon Bedrock 支持已内置，但这次录制用的是规则助手。 |

The terminal command, with the token set off camera:

```sh
npx -y @modelcontextprotocol/inspector --cli http://127.0.0.1:3030/api/mcp --transport http --header "Authorization: Bearer $TOKEN" --method tools/list
```

If the cut runs past 3:00, drop the letter segment first, then the landlord
segment. Never cut out a confirmation step.

## After recording

- [ ] Under 3:00. Check the token is unreadable in every frame, in the panel and in the terminal.
- [ ] No `.env.local`, no AWS console, no API key anywhere in frame.
- [ ] The photo captions *AI-GENERATED DEMO — NOT REAL EVIDENCE* and the simulation note are visible whenever those areas are on screen.
- [ ] No background music. The rules forbid copyrighted music and third-party trademarks.
- [ ] Upload to **YouTube or Vimeo**, visibility **Public** (not "Unlisted"). Title it with the project name. Paste the link into the Devpost form and open it in a private window to confirm it plays.
- [ ] Captions are optional if you speak English. [demo-captions.srt](demo-captions.srt) holds the same lines with approximate times; in YouTube Studio use **Subtitles → Add → Auto-sync** and paste the text so YouTube fits the timing to your actual recording.
