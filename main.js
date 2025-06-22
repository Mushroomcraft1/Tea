const config = require("./config.json")
const { Client, ThreadChannel } = require("oceanic.js")

const translations = require("./translations.json")
const expressions = require("./expressions.json")

const regexps = []

for (const exp in expressions) {
	const wildcardStart = exp.startsWith("*")
	const wildcardEnd = exp.endsWith("*")

	let chars = exp.split("")
	if (wildcardStart) chars.shift()
	if (wildcardEnd) chars.pop()

	let inputExp = "("

	if (!wildcardStart) inputExp += "?<=^|\\W"

	inputExp += ")("

	for (const char of chars) inputExp += "\\x" + char.charCodeAt(0).toString(16)

	inputExp += ")("

	if (!wildcardEnd) inputExp += "?=$|\\W"

	inputExp += ")"

	regexps.push({
		regex: new RegExp(inputExp, "ig"),
		translation: translations[expressions[exp]]
	})
}

const client = new Client({
	auth: "Bot " + config.token,
	gateway: {
		intents: ["GUILDS", "GUILD_MESSAGES", "MESSAGE_CONTENT"]
	},
	allowedMentions: {
		everyone: false,
		roles: false,
		repliedUser: false,
		users: false
	}
})

client.on("ready", async () => {
	console.log("Ready as", client.user.tag)
})

client.on("messageCreate", fix)
client.on("messageUpdate", fix)

/**
 * @param {import("oceanic.js").Message} message
 */
function fix(message) {
	if (message.author.bot) return

	let channel = message.channel,
		threadID

	if (channel instanceof ThreadChannel) (channel = message.channel.parent), (threadID = message.channel.id)
	if (!channel) return

	let content = message.content
	let embeds = []

	let changed = false
	let dontDelete = message.attachments.size > 0 || message.content.length > 1500

	if (dontDelete) {
		let content = ""

		for (const { regex, translation } of regexps) {
			if (message.content.match(regex)) {
				content += `**\\*${translation}**\n`.slice(0, 2000)
			}
		}

		client.rest.channels.createMessage(message.channelID, { content, messageReference: { messageID: message.id } }).catch(console.error)
		return
	}

	for (const { regex, translation } of regexps) {
		content = content
			.replaceAll(regex, (...arr) => {
				changed = true
				return `**${translation}**`
			})
			.slice(0, 2000)
	}

	if (changed) {
		// client.rest.channels.createMessage(message.channelID, { content, messageReference: message.messageReference, })

		if (message.referencedMessage) {
			const reply = message.referencedMessage
			let description = reply.content.slice(0, 50)

			if (reply.content.length == 0) description = "*Attachment*"
			if (reply.content.length > 50) description += "..."

			description += `\n\n[Jump to message](${reply.jumpLink})`

			embeds.push({
				author: {
					name: "Replying to " + reply.author.username,
					iconURL: reply.author.avatarURL(),
					url: reply.jumpLink
				},
				description,
				color: 0xaaaaff
			})
		}

		channel
			.getWebhooks()
			.then(arr => {
				for (const webhook of arr) {
					if (webhook.applicationID == client.user.id) {
						message.delete().catch(() => {})

						return webhook
							.execute({
								avatarURL: message.member.avatarURL(),
								username: message.member.nick ?? message.author.globalName,
								threadID,
								content,
								embeds
							})
							.catch(console.error)
					}
				}

				channel
					.createWebhook({
						name: "Corrector"
					})
					.then(webhook => {
						webhook
							.execute({
								avatarURL: message.member.avatarURL(),
								username: message.member.nick ?? message.author.globalName,
								threadID,
								content,
								embeds
							})
							.catch(console.error)
					})
			})
			.catch(console.error)
	}
}

// if you do not add a listener for the error event, any errors will cause an UncaughtError to be thrown,
// and your process may be killed as a result.
client.on("error", err => {
	console.error("Something Broke!", err)
})

client.connect()
