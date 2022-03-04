const assert = require("chai").assert;

const RedEntitiesConfig = require("../providersconfig.json").mariadbproviderconfig;
const testSchema = require("../testschema.json");

const RedEntities = require("../../lib/redentities")(RedEntitiesConfig);
const RedEntitiesTestUtils = require("../lib/redentitiestestutils");
const db = RedEntities.Entities(testSchema);

async function insertSampleUserEntity() {
    let name = RedEntitiesTestUtils.EntityShortId().replace("-","A").replace("_","B"); // Avoid _ and - to test order by methods

    let entity = { name: name, alias: RedEntitiesTestUtils.EntityShortId() };

    entity.ID = await db.users.I().V(entity).R();

    return entity;
}

async function insertSampleUserEntities( count ) {
    let r = [];

    for( let i = 0 ; i < count; i++ ) {
        let newEntity = await insertSampleUserEntity();

        r.push( newEntity );
    }

    return r;
}

describe( 'Mysql Redentities select tests', () => {
    before( async () => {
        await db.RemoveAndCreateDatabase( RedEntitiesConfig.database );
        await RedEntities.Entities( testSchema ).CreateSchema();            
    });

    after( async() => {
        await require("../../lib/providers/mariadb/MariaDBConnector").ClearPool();
    });

    it( '# Mysql Insert simple entity and check entity exists', async () => {        
        let user = await insertSampleUserEntity();
        let entity = await db.users.S().SingleById( user.ID );

        assert.equal( entity.ID, user.ID );
    });

    it( '# Mysql Try SingleById with no existing id', async () => {        
        db.users.S().SingleById( RedEntitiesTestUtils.EntityShortId() )
            .then( () => assert.fail("Should fail SingleById() method") )
            .catch( err => assert.ok(true) );
    });

    it( '# Mysql Insert simple entity and select by field', async () => {        
        let user = await insertSampleUserEntity();        
        let entity = await db.users.S().W("name = ?", user.name).Single();

        assert.equal( entity.name, user.name );
    });

    it( '# Mysql Try select by field with no existing field', async () => {
        await db.users.S().W("name = ?", RedEntitiesTestUtils.EntityShortId()).Single()
            .then( () => assert.fail("Shold fail Single() method") )
            .catch( err => assert.ok(true) )
    });

    it( '# Mysql Select all users', async () => {
        let entities = await db.users.S().Run();
    });

    it( '# Mysql Select count', async () => {
        let count = await db.users.S().Count();
        assert.isNumber( count );
    });

    it( '# Mysql Exists entity', async () => {
        let user = await insertSampleUserEntity();
        let exists = await db.users.S().W("name = ?", user.name).Exists();
        
        assert.isTrue(exists);
    });    

    it( '# Mysql Check no exists no existing entity', async () => {
        let userName = RedEntitiesTestUtils.EntityShortId();
        let exists = await db.users.S().W("name = ?", userName).Exists();
        
        assert.isFalse(exists);    
    });    

    it( '# Mysql Check boolean value with boolean value to true', async () => {
        let entityId = await db.booleantype.I().V( { value: "true" }).R();
        let entity = await db.booleantype.S().SingleById( entityId );

        assert.isTrue( entity.value );
    });

    it( '# Mysql Check boolean value with boolean value to false', async () => {
        let entityId = await db.booleantype.I().V( { value: "false" }).R();
        let entity = await db.booleantype.S().SingleById( entityId );

        assert.isFalse( entity.value );
    });

    it( '# Mysql Check datetime value', async () => {
        let now = new Date(new Date().toUTCString())

        let entityId = await db.datetimetype.I().V( { value: now } ).R();
    
        let entity = await db.datetimetype.S().SingleById( entityId );

        assert.equal(now.toString(), entity.value.toString());
    });

    it( '# Mysql Limit some values', async () => {
        await insertSampleUserEntities( 10 );

        let fiveUsers = await db.users.S().L(0,5).R();

        assert.equal( 5, fiveUsers.length );
    });

    it( '# Mysql Limit one element', async () => {
        await insertSampleUserEntities( 10 );
        
        let fiveUsers = await db.users.S().L(0,1).R();

        assert.equal( 1, fiveUsers.length );
    });

    it( '# Mysql Take some values', async () => {
        await insertSampleUserEntities( 10 );
        
        let fiveUsers = await db.users.S().T(5).R();

        assert.equal( 5, fiveUsers.length );
    });

    it( '# Mysql Take one element', async () => {
        await insertSampleUserEntities( 10 );
        
        let fiveUsers = await db.users.S().T(1).R();

        assert.equal( 1, fiveUsers.length );
    });

    it( '# Mysql Iterate all', async () => {
        await insertSampleUserEntities( 10 );

        let count = await db.users.S().Count();
        let counted = 0;

        let fnc = async (entity) => {
            counted++;
        }

        await db.users.S().IterateAll(fnc);

        assert.equal( count, counted );
    });

    it( '# Mysql Iterate all and check all different entities', async () => {
        await insertSampleUserEntities( 10 );

        let counted = 0;
        let keys = new Set();

        let fnc = async (entity) => {
            counted++;
            keys.add( entity.ID );
        }

        await db.users.S().IA(fnc);

        assert.equal( counted, keys.size );
    });

    it( '# Mysql Order by', async () => {
        await insertSampleUserEntities( 10 );

        await db.users.S().OrderBy("name").R();
    });

    it( '# Mysql Order by asc and check values', async () => {
        await insertSampleUserEntities( 10 );

        let entities = await db.users.S().OrderBy("name").R();

        for( let i = 0; i < entities.length-1; i++ ) {
            let name1 = entities[i].name;
            let name2 = entities[i+1].name;

            assert.equal( -1, name1.localeCompare(name2) );
        }
    });

    it( '# Mysql Order by desc and check values', async () => {
        await insertSampleUserEntities( 10 );

        let entities = await db.users.S().OB("name",false).R();

        for( let i = 0; i < entities.length-1; i++ ) {
            let name1 = entities[i].name;
            let name2 = entities[i+1].name;

            assert.equal( 1, name1.localeCompare(name2) );
        }
    });

    it( '# Mysql Iterate all with entities ordered', async() => {
        await insertSampleUserEntities( 10 );

        let counted = 0;
        let keys = new Set();

        let fnc = async (entity) => {
            counted++;
            keys.add( entity.ID );
        }

        await db.users.S().OB("Name").IA(fnc);

        assert.equal( counted, keys.size );
    });

    it( '# Mysql Insert key string in a key field', async() => {
        let key = RedEntitiesTestUtils.EntityShortId().replace("-","A").replace("_","B"); // Avoid _ and - to test order by methods

        let entity = { k0: key };
    
        entity.ID = await db.keytable.I().V(entity).R();
    
        assert.isString(entity.ID);
    });

    it( '# Mysql Insert and get key string in a key field', async() => {
        let key = RedEntitiesTestUtils.EntityShortId().replace("-","A").replace("_","B"); // Avoid _ and - to test order by methods

        let entity = { k0: key };
    
        entity.ID = await db.keytable.I().V(entity).R();
    
        let entity2 = await db.keytable.S().W("ID=?", entity.ID).Single();

        assert.equal(entity.ID,entity2.ID);
        assert.equal(entity.k0,entity2.k0);
    });

    it( '# Mysql Insert in a json field', async() => {
        let key = RedEntitiesTestUtils.EntityShortId().replace("-","A").replace("_","B"); // Avoid _ and - to test order by methods

        let entity = { j0: { value: key } };
    
        entity.ID = await db.jsontable.I().V(entity).R();
    
        assert.isString(entity.ID);
    });

    it( '# Mysql Insert in a json field and retrieve', async() => {
        let key = RedEntitiesTestUtils.EntityShortId().replace("-","A").replace("_","B"); // Avoid _ and - to test order by methods

        let entity = { j0: { value: key } };
    
        entity.ID = await db.jsontable.I().V(entity).R();
        let entity2 = await db.jsontable.S().W("ID=?", entity.ID).Single();
        
        assert.equal(entity.ID,entity2.ID);
        assert.equal(entity.j0.value,entity2.j0.value);
    });

    it( '# Mysql Insert in a float field and retrieve', async() => {
        let entity = { f: 1.9 };
    
        entity.ID = await db.floattable.I().V(entity).R();
        let entity2 = await db.floattable.S().W("ID=?", entity.ID).Single();
    
        assert.equal(entity.ID, entity2.ID);
        assert.equal(entity.f.value, entity2.f.value);
    });

    it( '# Mysql get query string', async () => {
        let query = await db.users.S().L(0,5).Q();     

        assert.isString( query );
    });
});