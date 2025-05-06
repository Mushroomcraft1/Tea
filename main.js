const config = require("./config.json")
const { Client } = require("oceanic.js")

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

client.on("messageCreate", message => {
	if (message.author.bot) return

	let content = message.content

	let changed = false

	for (const { regex, translation } of regexps) {
		content = content.replaceAll(regex, (...arr) => {
			changed = true
			return "**" + translation + "**"
		})
	}

	if (changed) {
		// client.rest.channels.createMessage(message.channelID, { content })

		message.channel
			.getWebhooks()
			.then(arr => {
				for (const webhook of arr) {
					if (webhook.applicationID == client.user.id) {
						message.delete().catch(() => {})

						return webhook
							.execute({
								avatarURL: message.member.avatarURL(),
								username: message.member.nick ?? message.author.globalName,
								content
							})
							.catch(console.error)
					}
				}

				message.channel
					.createWebhook({
						name: "Corrector"
					})
					.then(webhook => {
						webhook
							.execute({
								avatarURL: message.member.avatarURL(),
								username: message.member.nick ?? message.author.globalName,
								content
							})
							.catch(console.error)
					})
			})
			.catch(console.error)
	}
})

// if you do not add a listener for the error event, any errors will cause an UncaughtError to be thrown,
// and your process may be killed as a result.
client.on("error", err => {
	console.error("Something Broke!", err)
})

client.connect()
