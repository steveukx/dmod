
var DMod = require('../../../src/index');

var models = new DMod(new DMod.adapters.SQLite());

models.register(
    DMod.Table('User').autoIncrementField('id')
        .uniqueField('username')
        .field('name'),

    DMod.Table('Task').autoIncrementField('id')
        .uniqueField('name')
        .dateTimeField('completed')
        .dateTimeField('created')
        .dateTimeField('due')
        .hasOne('User')
);
