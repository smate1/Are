const Role = require('./models/Role');

/**
 * Initialize default roles in the database if they don't exist
 * @returns {Promise<void>}
 */
async function initRoles() {
    try {
        // Check if roles already exist
        const rolesCount = await Role.countDocuments();

        if (rolesCount === 0) {
            // Create default roles if none exist
            await Role.create({ value: 'USER' });
            await Role.create({ value: 'ADMIN' });

            console.log('✅ Default roles created successfully');
        } else {
            console.log('✅ Roles already exist in the database');
        }
    } catch (error) {
        console.error('❌ Error initializing roles:', error);
    }
}

module.exports = initRoles;
