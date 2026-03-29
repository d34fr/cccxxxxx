import {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType,
  PermissionFlagsBits
} from 'discord.js';
import { sanctions, getGuildSettings } from '../db.js';
import { canUseStaffCommands, getTier, isHigherRole, ensureBotCanManageRole } from '../utils/permissions.js';
import { sendLog } from '../utils/logs.js';
import { safeDM, dmTemplates, ts } from '../utils/dm.js';
import { scheduleMuteExpiry } from '../services/scheduler.js';
import { createErrorEmbed, createSuccessEmbed, createWarningEmbed, createEmbed } from '../utils/embed.js';

const MUTE_REASONS = [
  { label: 'Publicité — 35m', value: 'pub', minutes: 35, description: 'Promotion d’un autre serveur (liens d’invite, pub en chat ou en vocal, MP de pub).' },
  { label: 'Racisme/homophobie/blasphème — 30m', value: 'racisme', minutes: 30, description: 'Propos haineux (racistes, homophobes) ou blasphématoires visant un membre ou un groupe.' },
  { label: 'Propos déplacés — 25m', value: 'deplaces', minutes: 25, description: 'Insultes, remarques dégradantes, provocations, manque de respect envers un membre/staff.' },
  { label: 'NSFW — 20m', value: 'nsfw', minutes: 20, description: 'Partage de contenu à caractère sexuel/explicite (images, liens, texte)' },
  { label: 'Spam — 10m', value: 'spam', minutes: 10, description: 'Flood de messages, répétitions (mentions/emoji), caps abusifs, copypasta perturbant le chat.' },
  { label: 'Soundboard — 5m', value: 'soundboard', minutes: 5, description: 'Utilisation d’un soundboard en vocal perturbant la discussion ou couvrant les autres.' },
];

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Mute un membre via un menu de raisons prédéfinies')
  .addUserOption(o => o.setName('membre').setDescription('Membre à mute').setRequired(true));

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Cette commande ne peut être utilisée qu\'en serveur.')],
      ephemeral: true
    });
  }

  const guild   = interaction.guild;
  const me      = guild.members.me;
  const guildId = guild.id;

  const target = interaction.options.getMember('membre', true);
  const gs     = getGuildSettings(guildId);

  // Vérif salon sanctions
  const sanctionChannel = gs.sanction_channel_id ? guild.channels.cache.get(gs.sanction_channel_id) : null;
  if (sanctionChannel && interaction.channelId !== sanctionChannel.id) {
    return interaction.reply({
      embeds: [createErrorEmbed(`Utilise cette commande dans ${sanctionChannel}.`)],
      ephemeral: true
    });
  }

  // Vérif permissions staff
  let allowed = canUseStaffCommands(guildId, interaction.member);
  if (!allowed && sanctionChannel) {
    try { allowed = sanctionChannel.permissionsFor(interaction.member).has(PermissionFlagsBits.ViewChannel); } catch {}
  }
  if (!allowed) {
    return interaction.reply({
      embeds: [createErrorEmbed('Tu n\'as pas la permission d\'utiliser cette commande.')],
      ephemeral: true
    });
  }

  // Vérif config logs & rôle mute
  if (!gs.logs_channel_id) {
    return interaction.reply({
      embeds: [createErrorEmbed('Configure le salon de logs avec `/config logs`.')],
      ephemeral: true
    });
  }
  if (!gs.mute_role_id) {
    return interaction.reply({
      embeds: [createErrorEmbed('Configure le rôle **Muted** avec `/configmute role`.')],
      ephemeral: true
    });
  }

  // Vérif hiérarchie
  let actorTier  = getTier(guildId, interaction.member);
  let targetTier = getTier(guildId, target);
  if (sanctionChannel) {
    const actorSees  = sanctionChannel.permissionsFor(interaction.member)?.has(PermissionFlagsBits.ViewChannel);
    const targetSees = sanctionChannel.permissionsFor(target)?.has(PermissionFlagsBits.ViewChannel);
    if (actorTier === 'MEMBER' && actorSees)  actorTier = 'STAFF';
    if (targetTier === 'MEMBER' && targetSees) targetTier = 'STAFF';
  }

  const forbiddenByTier = (actorTier === 'STAFF') && (['STAFF','GESTION','OWNERMUTE','SYS+'].includes(targetTier));
  if (forbiddenByTier && actorTier === 'STAFF') {
    return interaction.reply({
      embeds: [createErrorEmbed('Tu ne peux pas mute un membre **Staff**. Seul Gestion / OwnerMute / SYS+ le peuvent.')],
      ephemeral: true
    });
  }

  if (!isHigherRole(interaction.member, target) && actorTier !== 'SYS+' && actorTier !== 'OWNERMUTE') {
    return interaction.reply({
      embeds: [createErrorEmbed('Tu ne peux pas agir sur ce membre.')],
      ephemeral: true
    });
  }

  // Vérif si bot peut gérer le rôle
  const manageCheck = ensureBotCanManageRole(guild, gs.mute_role_id, me);
  if (!manageCheck.ok) {
    return interaction.reply({
      embeds: [createErrorEmbed(manageCheck.reason)],
      ephemeral: true
    });
  }

  // Menu des raisons
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`mute_reason:${target.id}:${interaction.user.id}`)
    .setPlaceholder('Choisis une raison de mute')
    .addOptions(MUTE_REASONS.map(r => ({
      label: r.label,
      value: r.value,
      description: r.description
    })));

  const row = new ActionRowBuilder().addComponents(menu);

  await interaction.reply({
    embeds: [createWarningEmbed(`📝 Choisis la raison du mute pour ${target} :`)],
    components: [row],
    ephemeral: true
  });

  // Attente du choix
  const replyMsg = await interaction.fetchReply();
  const sel = await replyMsg.awaitMessageComponent({
    componentType: ComponentType.StringSelect,
    time: 60_000,
    filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('mute_reason:')
  }).catch(() => null);

  if (!sel) {
    return interaction.editReply({
      embeds: [createWarningEmbed('Aucune raison sélectionnée dans le temps imparti.')],
      components: []
    });
  }

  await sel.deferUpdate();

  const choice = MUTE_REASONS.find(r => r.value === sel.values[0]);
  if (!choice) {
    return interaction.editReply({
      embeds: [createErrorEmbed('La raison sélectionnée est invalide.')],
      components: []
    });
  }

  const durationMs = choice.minutes * 60 * 1000;
  const reason     = choice.label;

  const role = guild.roles.cache.get(gs.mute_role_id);
  if (!role) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Rôle Muted introuvable.')],
      components: []
    });
  }

  const added = await target.roles.add(role.id).then(() => true).catch(() => false);
  if (!added) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Impossible d\'assigner le rôle Muted.')],
      components: []
    });
  }

// 🔊 Si le membre est en vocal, on le déplace dans un salon aléatoire, lui donne le rôle mute, puis le remet dans son salon d'origine
if (target.voice && target.voice.channel) {
  const originalChannel = target.voice.channel;
  const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased() && c.id !== originalChannel.id);

  if (voiceChannels.size > 0) {
    const randomChannel = voiceChannels.random();

    try {
      // Étape 1 : Déplacer dans un salon aléatoire
      await target.voice.setChannel(randomChannel);

      // Étape 2 : Ajouter le rôle mute
      await target.roles.add(role.id).catch(() => {});

      // Petite pause pour éviter les conflits Discord
      await new Promise(res => setTimeout(res, 1500));

      // Étape 3 : Remettre dans le salon d'origine
      await target.voice.setChannel(originalChannel);
    } catch (err) {
      console.error(`Erreur lors du traitement vocal pour ${target.user.tag} :`, err);
      await interaction.channel.send({
        embeds: [
          createErrorEmbed(`Impossible d'effectuer la procédure vocale pour ${target}.`)
        ]
      }).catch(() => {});
    }
  } else {
    // Si aucun autre salon vocal, on mute directement en ajoutant le rôle
    try {
      await target.roles.add(role.id);
    } catch (err) {
      console.error(`Impossible d'ajouter le rôle mute pour ${target.user.tag} :`, err);
      await interaction.channel.send({
        embeds: [
          createErrorEmbed(`Impossible d'ajouter le rôle mute pour ${target}.`)
        ]
      }).catch(() => {});
    }
  }
} else {
  // Si pas en vocal, on fait juste le rôle
  await target.roles.add(role.id).catch(() => {});
}


  // Sauvegarde en DB + planification de l’expiration
  const { id, created_at } = sanctions.createMute(guildId, target.id, reason, interaction.user.id, durationMs);
  scheduleMuteExpiry(interaction.client, { id, created_at, duration_ms: durationMs });

  // DM utilisateur
  const templates = dmTemplates();
  const expiresAt = created_at + durationMs;
  await safeDM(target.user, templates.mute({
    guild: guild.name,
    reason,
    moderatorTag: interaction.user.tag,
    humanDuration: `${choice.minutes}m`,
    expiresTs: ts(expiresAt)
  }));

  // Logs
  await sendLog(guild, (e) => {
    return createEmbed({
      title: 'MUTE',
      color: '#FFA500',
      fields: [
        { name: '👤 Auteur',      value: `${interaction.user}`, inline: true },
        { name: '👥 Cible',       value: `${target}`,           inline: true },
        { name: '📝 Raison',      value: reason,                inline: false },
        { name: '🕐 Durée',       value: `${choice.minutes}m`,  inline: true },
        { name: '🕐 Fin prévue',  value: `<t:${ts(expiresAt)}:F> (<t:${ts(expiresAt)}:R>)`, inline: true },
        { name: '🆔 Sanction ID', value: String(id),            inline: true }
      ],
      timestamp: new Date(created_at)
    });
  }).catch(() => {});

  // Confirmation publique
  await interaction.channel.send({
    embeds: [createEmbed({
      title: '✅ Mute appliqué',
      color: '#FFA500',
      description: `📝 ${target} a été mute pour **${choice.label}**\n**👤 Par :** ${interaction.user}\n**ID Sanction :** ${id}`
    })],
    allowedMentions: { users: [target.id] }
  });

  return interaction.editReply({
    embeds: [createSuccessEmbed(`Le mute de ${target} a été appliqué avec succès.`)],
    components: []
  });
}
