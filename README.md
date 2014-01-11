# SSA IR

## Usage

```javascript
var ssa = require('ssa-ir');

var cfg = ssa.parse(function() {/*
  block B1 -> B2, B3
    arg1 = instr1 %literal1, %literal2
    id2 = instr2 arg1
  block B2
    ret id2
  block B3
    ret arg1
*/});

console.log(cfg);
/*
[ { id: 'B1',
    instructions:
     [ { id: 'arg1',
         type: 'instr1',
         inputs: [ { type: 'js', value: 'literal1' }, { type: 'js', value: 42 } ] },
       { id: 'id2',
         type: 'instr2',
         inputs: [ { type: 'instruction', id: 'arg1' } ] } ],
    successors: [ 'B2', 'B3' ] },
  { id: 'B2',
    instructions:
     [ { id: null,
         type: 'ret',
         inputs: [ { type: 'instruction', id: 'id2' } ] } ],
    successors: [] },
  { id: 'B3',
    instructions:
     [ { id: null,
         type: 'ret',
         inputs: [ { type: 'instruction', id: 'arg1' } ] } ],
    successors: [] } ]
*/

console.log(ssa.stringify(cfg));
/*
block B1 -> B2, B3
  instr1 %"literal1", %42
  instr2 arg1
block B2
  ret id2
block B3
  ret arg1
*/
```

#### LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2014.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.

[0]: http://en.wikipedia.org/wiki/Static_single_assignment_form
