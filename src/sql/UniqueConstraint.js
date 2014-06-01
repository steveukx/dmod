
var UniqueConstraint = module.exports = function (name) {
    UniqueConstraint.superclass.call(this, 'UNIQUE', 'UniqueFields' + name);
};

require('util').inherits(UniqueConstraint, UniqueConstraint.superclass = require('./TableConstraint'));

