
var DMod = require('../../../src/index');

var models = new DMod(new DMod.adapters.SQLite());

models.register(
    DMod.Table('Task').autoIncrementField('id')
        .uniqueField('name')
        .dateTimeField('created')
        .dateTimeField('due')
);
