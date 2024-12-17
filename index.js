const { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const Sequelize = require('sequelize');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');

const dotenv = require('dotenv');
dotenv.config();
const soundPath = './sounds'

const sequelize = new Sequelize('database', 'user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	// SQLite only
	storage: 'database.sqlite',
});

const Users = sequelize.define('tags', {
	username: Sequelize.STRING,
	usage_count: {
		type: Sequelize.INTEGER,
		defaultValue: 70,
		allowNull: false,
	}
});

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildVoiceStates]
});

const textCommands = [];
client.commands = new Collection();
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands'));
for (const file of commandFiles) {
	const filePath = path.join(path.join(__dirname, 'commands'), file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command) {
		textCommands.push(command.data.toJSON());
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
	try {
		console.log(`Started refreshing ${textCommands.length} application (/) commands.`);
		// mettre les values dans le .env
		const data = await rest.put(
			Routes.applicationCommands(process.env.DISCORD_APPID, process.env.DISCORD_GUILD),
			{ body: textCommands },
		);
		console.log("Init database");
		Users.sync();
		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})();

const getAllOldMessages = async (channel, limit = 500) => {
	const allMessages = [];
	let last_id;

	while (true) {
		const options = { limit: 100 };
		if (last_id) {
			options.before = last_id;
		}

		const messages = await channel.messages.fetch(options);
		messages.forEach(message => {
			if (message.content.includes("n°")) {
				allMessages.push(message);
			}
		});
		last_id = messages.last().id;

		if (messages.size != 100 || allMessages >= limit) {
			break;
		}
	}
	return allMessages;
}

const playSound = (guild) => {
	const connection = joinVoiceChannel({
		channelId: '1318567332565745664', //process.env.DISCORD_CHANNEL,
		guildId: process.env.DISCORD_GUILD,
		adapterCreator: guild.voiceAdapterCreator,
	});
	connection.on(VoiceConnectionStatus.Ready, () => {
		console.log('----- Bot is ready to play audio ! -----');
	});
	// Créer une ressource audio à partir du fichier
	const resource = createAudioResource(path.join(__dirname, `gaylord.ogg`), {
		inputType: AudioPlayerStatus.Playing
	});
	const player = createAudioPlayer();

	player.play(resource);
	connection.subscribe(player);

	player.on(AudioPlayerStatus.Idle, () => {
		connection.destroy();
	});
}

client.once(Events.ClientReady, async readyClient => {
	console.log("Init SQLITE if file not exists");
	if (!fs.existsSync("database.sqlite")) {
		await Users.create({
			username: "Admin",
			usage_count: 0
		});
	}
	const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL);

	console.log("Récupération des anciens messages");
	const oldMessages = await getAllOldMessages(channel);
	const oldMessagesToAdd = [];

	if (oldMessages) {
		try {
			oldMessages.forEach(async message => {
				const regex = /@([^@]+) n°/;
				const match = message.content.match(regex);
				if (match) {
					const usernameRegex = match[1];
					const username = client.users.cache.get(usernameRegex.slice(0, -1)).globalName;
					const index = message.content.indexOf("n°");
					const char = "n°";
					//TODO: maybe find next characters until space...
					const count = message.content.slice(index + char.length, index + char.length + 3).trim();
					oldMessagesToAdd.push({
						username: username,
						usage_count: count
					});
				}
			});
			oldMessagesToAdd.sort((a, b) => a.usage_count - b.usage_count);
			await Users.bulkCreate(oldMessagesToAdd);
		} catch (error) {
			console.log("Error while adding old messages", error)
		}
		console.log("All old messages added")
	}
	console.log(`Ready! Bot: ${readyClient.user.tag}`);
});

const handleGaylordCommand = async (interaction, command, user, role) => {
	try {
		await user.roles.add(role);
		// get all gaylords and order by usage count asc
		const res = await Users.findAll({ order: [['usage_count', 'ASC']] });
		const lastElement = res[res.length - 1];
		const newUser = await Users.create({
			username: user.user.globalName,
			usage_count: lastElement.usage_count + 1
		});
		const citation = interaction.options.getString('message');
		console.log("------ Add new user ------");
		await command.execute(interaction, user, citation, role, newUser.usage_count);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		}
	}
}

const handleStatsCommand = async (interaction, command) => {
	const targetUser = interaction.options.getMember('user');

	if (targetUser) {
		const res = await Users.count({
			where: {
				username: targetUser.user.globalName
			}
		})
		console.log("targetUser", targetUser)
		command.execute(interaction, targetUser.user.globalName, res, true);
	} else {
		const res = await Users.findAll({
			attributes: [
				'username',
				[Sequelize.fn('COUNT', Sequelize.col('username')), 'count']
			],
			group: ['username'],
			order: [[Sequelize.fn('COUNT', Sequelize.col('username')), 'DESC']],
			limit: 1
		})
		command.execute(interaction, res[0].get('username'), res[0].get('count'), false);
	}
}

const kickGaylordRole = async (role) => {
	if (!role) {
		await interaction.reply("Pas de rôle gaylord existant");
	}
	// suppression du role pour tout le monde avant de le mettre à celui qui le mérite
	role.members.forEach((member, i) => {
		member.roles.remove(role);
	})
}


client.on(Events.InteractionCreate, async (interaction) => {
	const user = interaction.options.getMember('user');
	if (!interaction.isCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);
	if (command.data.name === 'stats') {
		handleStatsCommand(interaction, command);
	} else if (command.data.name === 'gaylord') {
		const guild = interaction.guild;
		const role = guild.roles.cache.find(role => role.name === 'Gay Lord');
		kickGaylordRole(role);
		handleGaylordCommand(interaction, command, user, role)
		// playSound(guild);
	} else {
		console.error(`[ERROR] No command matching ${command.name} was found.`);
		interaction.reply(`Aucune commande pour : ${command.name} a été trouvée.`)
	}
});

client.login(process.env.DISCORD_TOKEN);