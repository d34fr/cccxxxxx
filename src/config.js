import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'config.json');

if (!fs.existsSync(configPath)) {
  console.error('❌ config.json manquant. Créez le fichier avec votre token et configuration.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

export const DISCORD_TOKEN = config.token;
export const BOT_OWNERS = config.botOwners || [];
export const GUILD_ID = config.guildId || null;
export const DEFAULT_EMBED = config.defaultEmbed;

if (!DISCORD_TOKEN || DISCORD_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
  console.error('❌ Token Discord manquant dans config.json');
  process.exit(1);
}

if (!BOT_OWNERS.length || BOT_OWNERS.includes('YOUR_USER_ID_HERE')) {
  console.warn('⚠️ Aucun propriétaire configuré dans config.json');
}