import supabase from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Debug script to check automation rules configuration
 * Run with: node scripts/debug_automation.js <instagram_account_id> <media_id>
 */

async function debugAutomation() {
    const instagramAccountId = process.argv[2];
    const mediaId = process.argv[3];

    if (!instagramAccountId) {
        console.error('❌ Usage: node scripts/debug_automation.js <instagram_account_id> [media_id]');
        console.error('   Example: node scripts/debug_automation.js abc123 17895695668004550');
        process.exit(1);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('🔍 AUTOMATION RULES DEBUG');
    console.log('═'.repeat(70));
    console.log(`Instagram Account ID: ${instagramAccountId}`);
    console.log(`Media ID: ${mediaId || 'Not specified (will show all rules)'}`);
    console.log('═'.repeat(70) + '\n');

    try {
        // Fetch all rules for this account
        const { data: allRules, error } = await supabase
            .from('automation_rules')
            .select('*')
            .eq('instagram_account_id', instagramAccountId);

        if (error) {
            console.error('❌ Database error:', error);
            process.exit(1);
        }

        if (!allRules || allRules.length === 0) {
            console.log('📭 No automation rules found for this account.');
            process.exit(0);
        }

        console.log(`✅ Found ${allRules.length} total rule(s)\n`);

        // Separate rules
        const generalRules = allRules.filter(rule =>
            !rule.media_id &&
            (!rule.media_ids || rule.media_ids.length === 0)
        );

        const specificRules = allRules.filter(rule =>
            rule.media_id || (rule.media_ids && rule.media_ids.length > 0)
        );

        // Display General Rules
        console.log('┌─ GENERAL AUTO-REPLY RULES');
        if (generalRules.length === 0) {
            console.log('│  📭 No general rules found');
        } else {
            generalRules.forEach((rule, idx) => {
                console.log(`│`);
                console.log(`│  Rule #${idx + 1}: ${rule.name}`);
                console.log(`│  ├─ ID: ${rule.id}`);
                console.log(`│  ├─ Status: ${rule.is_active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
                console.log(`│  ├─ Keywords: ${rule.keywords?.length > 0 ? rule.keywords.join(', ') : '(empty - matches all)'}`);
                console.log(`│  ├─ Comment Reply: "${rule.comment_reply?.substring(0, 60)}${rule.comment_reply?.length > 60 ? '...' : ''}"`);
                console.log(`│  ├─ Send DM: ${rule.send_dm ? 'Yes' : 'No'}`);
                if (rule.send_dm) {
                    console.log(`│  └─ DM Reply: "${rule.dm_reply?.substring(0, 60)}${rule.dm_reply?.length > 60 ? '...' : ''}"`);
                } else {
                    console.log(`│  └─`);
                }
            });
        }
        console.log('└─\n');

        // Display Post Override Rules
        console.log('┌─ POST OVERRIDE RULES');
        if (specificRules.length === 0) {
            console.log('│  📭 No post override rules found');
        } else {
            specificRules.forEach((rule, idx) => {
                console.log(`│`);
                console.log(`│  Override #${idx + 1}: ${rule.name}`);
                console.log(`│  ├─ ID: ${rule.id}`);
                console.log(`│  ├─ Status: ${rule.is_active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
                console.log(`│  ├─ Target Posts (media_ids): ${rule.media_ids?.length > 0 ? rule.media_ids.join(', ') : '(none)'}`);
                console.log(`│  ├─ Legacy media_id: ${rule.media_id || '(none)'}`);
                console.log(`│  ├─ Keywords: ${rule.keywords?.length > 0 ? rule.keywords.join(', ') : '(empty - matches all)'}`);
                console.log(`│  ├─ Comment Reply: "${rule.comment_reply?.substring(0, 60)}${rule.comment_reply?.length > 60 ? '...' : ''}"`);
                console.log(`│  ├─ Send DM: ${rule.send_dm ? 'Yes' : 'No'}`);
                if (rule.send_dm) {
                    console.log(`│  └─ DM Reply: "${rule.dm_reply?.substring(0, 60)}${rule.dm_reply?.length > 60 ? '...' : ''}"`);
                } else {
                    console.log(`│  └─`);
                }
            });
        }
        console.log('└─\n');

        // If media_id is provided, simulate the matching logic
        if (mediaId) {
            console.log('┌─ SIMULATION FOR MEDIA ID: ' + mediaId);
            
            const matchingSpecificRules = specificRules.filter(rule =>
                rule.is_active &&
                (rule.media_id === mediaId ||
                    (rule.media_ids && Array.isArray(rule.media_ids) && rule.media_ids.includes(mediaId)))
            );

            if (matchingSpecificRules.length > 0) {
                console.log(`│  ✅ Found ${matchingSpecificRules.length} ACTIVE post override(s) for this media`);
                console.log(`│  📋 These rules will be used (general rule will be IGNORED):`);
                matchingSpecificRules.forEach((rule, idx) => {
                    console.log(`│     ${idx + 1}. ${rule.name} (ID: ${rule.id})`);
                });
            } else {
                console.log(`│  📭 No active post overrides found for this media`);
                
                const activeGeneralRules = generalRules.filter(r => r.is_active);
                if (activeGeneralRules.length > 0) {
                    console.log(`│  ✅ Will fall back to GENERAL rule:`);
                    activeGeneralRules.forEach((rule, idx) => {
                        console.log(`│     ${idx + 1}. ${rule.name} (ID: ${rule.id})`);
                    });
                } else {
                    console.log(`│  ❌ No active general rule either - NO AUTOMATION WILL RUN`);
                }
            }
            console.log('└─\n');
        }

        console.log('═'.repeat(70));
        console.log('💡 TIPS:');
        console.log('   • Post overrides need media_ids array populated');
        console.log('   • Rules must have is_active = true to work');
        console.log('   • If a post has an active override, general rule is ignored');
        console.log('   • Empty keywords array = matches ALL comments');
        console.log('═'.repeat(70) + '\n');

    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

debugAutomation();
