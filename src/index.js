import { Client, Collection, GatewayIntentBits, Partials, Events } from 'discord.js';
import { DISCORD_TOKEN, GUILD_ID } from './config.js';
import { REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { getGuildSettings } from './db.js';
import { bootstrapSchedulers } from './services/scheduler.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

client.getGuildSettings = getGuildSettings;

// Load commands dynamically
client.commands = new Collection();
const commandsPath = path.join(process.cwd(), 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const mod = await import(`./commands/${file}`);
  if (mod.data && mod.execute) {
    client.commands.set(mod.data.name, mod);
  }
}

// Deploy commands function
async function deployCommands() {
  const commands = [];
  for (const [name, command] of client.commands) {
    if (command.data) {
      commands.push(command.data.toJSON());
    }
  }

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  
  try {
    const appId = (await rest.get(Routes.oauth2CurrentApplication())).id;
    
    if (GUILD_ID) {
      const data = await rest.put(Routes.applicationGuildCommands(appId, GUILD_ID), { body: commands });
      console.log(`✅ ${data.length} commandes guild déployées.`);
    } else {
      const data = await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log(`✅ ${data.length} commandes globales déployées.`);
    }
  } catch (error) {
    console.error('Erreur lors du déploiement des commandes:', error);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  await deployCommands();
  await bootstrapSchedulers(client).catch(console.error);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    await cmd.execute(interaction);
  } catch (e) {
    console.error(e);
    if (interaction.deferred || interaction.replied) {
      interaction.editReply({ content: '❌ Erreur.' }).catch(()=>{});
    } else {
      interaction.reply({ content: '❌ Erreur.', ephemeral: true }).catch(()=>{});
    }
  }
});

client.login(DISCORD_TOKEN);
