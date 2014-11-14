function Parser(source, locals) {
  this.source = source;
  this.locals = locals || {};
  this.result = [];
  this.block = null;
  this.conds = [];
  this.condStack = [];
}

exports.parse = function parse(source, locals) {
  return new Parser(source, locals).run();
};

Parser.prototype.run = function run() {
  var lines = this.source.toString()
                         .replace(/^function.*{(\/\*)?|(\*\/)}$/g, '')
                         .split(/\r\n|\r|\n/g);
  for (var i = 0; i < lines.length; i++)
    this.parseLine(lines[i].trim());

  if (this.block !== null)
    this.result.push(this.block);

  return this.result;
};

Parser.prototype.parseLine = function parseLine(line) {
  var match;

  // Comments
  if (/^\/\//.test(line))
    return;

  if (this.parseConditional(line))
    return;

  line = this.replaceLocal(line);

  // If we are inside falsey conditional, skip parsing the lines
  if (this.conds.length && !this.conds[this.conds.length - 1])
    return;

  if (this.parseBlock(line))
    return;

  this.parseInstruction(line);
};

Parser.prototype.eval = function _eval(expr) {
  var res;
  with (this.locals) {
    res = eval('(' + expr + ')');
  }
  return res;
};

Parser.prototype.parseConditional = function parseConditional(line) {
  // Conditionals
  var re = /^#(if|elif|else|endif)(\s+(.*))?$/;
  match = line.match(re);
  if (match === null)
    return false;

  if (match[1] === 'else') {
    var last = this.condStack[this.condStack.length - 1];
    this.conds[this.conds.length - 1] = !last;
    return true;
  }

  if (match[1] === 'endif') {
    this.conds.pop();
    this.condStack.pop();
    return true;
  }

  if (match[1] === 'elif' && this.condStack[this.condStack.length - 1]) {
    this.conds[this.conds.length - 1] = false;
    return true;
  }

  var expr = this.eval(match[2] || '');
  if (match[1] === 'if') {
    this.conds.push(expr);
    this.condStack.push(expr);
  } else {
    // elif
    this.conds[this.conds.length - 1] = expr;
    this.condStack[this.condStack.length - 1] = expr;
  }

  return true;
};

Parser.prototype.replaceLocal = function replaceLocal(line) {
  var self = this;
  return line.replace(/\{([^}]*)\}/, function(all, local) {
    return JSON.stringify(self.eval(local));
  });
};

Parser.prototype.parseBlock = function parseBlock(line) {
  var re = /^block\s+([\w\d]+)(?:\s+->\s+([\w\d]+)(?:\s*,\s*([\w\d]+))?)?(\s*\/\/.*$)?/;
  var match = line.match(re);
  if (match === null)
    return false;

  if (this.block !== null)
    this.result.push(this.block);

  this.block = { id: match[1], instructions: [], successors: [] };
  if (match[2])
    this.block.successors.push(match[2]);
  if (match[3])
    this.block.successors.push(match[3]);

  return true;
};

Parser.prototype.parseInstruction = function parseInstruction(line) {
  // Instruction
  var match = line.match(
    /^(?:(@)?([\w\d\/\-\.]+)\s*=\s*)?([\w\d\/\-\.]+)(?:\s+([^#]+?))?(?:\s*#\s*([\w\d\/\-\.]+))?\s*$/
  );
  if (match === null)
    return;

  var instr = {
    assign: !!match[1],
    id: match[2] || null,
    type: match[3],
    astId: match[5] || null,
    inputs: match[4] && match[4].split(/\s*,\s*/g).map(function(input) {
      if (/^%undefined/.test(input))
        return { type: 'js', value: undefined };
      else if (/^%/.test(input))
        return { type: 'js', value: JSON.parse(input.slice(1)) };
      else if (/^@/.test(input))
        return { type: 'variable', id: input.slice(1) };
      else
        return { type: 'instruction', id: input };
    }) || []
  };
  this.block.instructions.push(instr);
};

exports.stringify = function stringify(blocks) {
  var res = '';
  blocks.forEach(function(block) {
    res += 'block ' + block.id;
    if (block.successors.length > 0)
      res += ' -> ' + block.successors.join(', ');
    res += '\n';

    block.instructions.forEach(function(instr) {
      res += '  ';

      res += exports.stringifyInstr(instr);

      res += '\n';
    });
  });
  return res;
};

function valueToStr(value) {
  if (value.type === 'js')
    return '%' + JSON.stringify(value.value);
  else if (value.type === 'variable')
    return '@' + value.id;
  else if (value.type === 'register')
    return '$' + value.id;
  else if (value.type === 'stack')
    return '[' + value.id + ']';
  else
    return value.id;
}

exports.stringifyInstr = function stringifyInstr(instr) {
  var res = '';

  if (instr.output)
    res += valueToStr(instr.output) + ' = ';
  else if (instr.id)
    res += (instr.assign ? '@' : '') + instr.id + ' = ';

  res += instr.type;
  if (instr.inputs && instr.inputs.length > 0)
    res += ' ' + instr.inputs.map(valueToStr).join(', ');
  if (instr.scratch && instr.scratch.length > 0)
    res += ' |' + instr.scratch.map(valueToStr).join(', ') + '|';
  if (instr.moves && instr.moves.length) {
    res += ' {';
    res += instr.moves.map(function(move) {
      var from = valueToStr(move.from);
      var to = valueToStr(move.to);
      if (move.type === 'move')
        return from + ' => ' + to;
      else
        return from + ' <=> ' + to;
    }).join(', ');
    res += '}';
  }

  if (instr.astId !== undefined && instr.astId !== null)
    res += ' # ' + instr.astId;

  return res;
};

exports.dotify = function dotify(cfg) {
  var res = 'digraph {\n' +
            '  node[shape=record];\n';

  for (var i = 0; i < cfg.length; i++) {
    var block = cfg[i];

    for (var j = 0; j < block.successors.length; j++) {
      var succ = block.successors[j];
      res += '  ' + block.id + ' -> '  + succ + ';\n';
    }

    res += '  ' + block.id + '[label="{' + block.id + '|';
    for (var j = 0; j < block.instructions.length; j++) {
      var instr = exports.stringifyInstr(block.instructions[j]);

      res += (j !== 0 ? '|' : '');
      res += instr.replace(/(["\|<>\\{}])/g, '\\$1');
    }
    res += '}"];\n';
  }

  res += '}\n';
  return res;
};
