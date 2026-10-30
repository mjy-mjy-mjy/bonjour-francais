"""Shared grammar source integrity and unresolved-token regression."""
import unittest,json,copy
from grammar_build import ROOT,load_grammar,expand_grammar
class GrammarBuildTests(unittest.TestCase):
 def test_all_bindings_expand_from_one_source(self):
  data=load_grammar()
  for r in data['records']:
   for b in r['blocks']:
    source=json.loads((ROOT/'lessons'/f"{b['lesson']:02}.json").read_text());expanded=expand_grammar(source,data)
    self.assertEqual(next(s for s in expanded['sections'] if s['id']==b['section'])['html'],b['html'])
    self.assertIn('{{grammar:',next(s for s in source['sections'] if s['id']==b['section'])['html'])
 def test_missing_shared_block_fails_instead_of_publishing_placeholder(self):
  data=load_grammar();broken=copy.deepcopy(data);broken['records'][0]['blocks']=[]
  source=json.loads((ROOT/'lessons/02.json').read_text())
  with self.assertRaises(KeyError):expand_grammar(source,broken)
if __name__=='__main__':unittest.main()
