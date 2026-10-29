"""Focused build tests for shared-source propagation and malformed references."""
import copy
import json
import unittest
from verb_build import ROOT, load_verbs, expand_lesson, validate_references

class SharedBuildTests(unittest.TestCase):
    def setUp(self):
        self.data=load_verbs()
        self.authored={i:json.loads((ROOT/f'lessons/{i:02}.json').read_text()) for i in range(1,21)}

    def test_changed_form_propagates_to_all_bound_lessons_without_touching_author_sources(self):
        records=copy.deepcopy(self.data['records'])
        record=next(r for r in records if r['infinitive']=='s’appeler')
        record['forms'][3]='SHARED-CHECK'
        for number in [1,15]:
            compiled=expand_lesson(self.authored[number],records)
            self.assertIn('SHARED-CHECK',''.join(s['html'] for s in compiled['sections']))
            self.assertNotIn('SHARED-CHECK',''.join(s['html'] for s in self.authored[number]['sections']))

    def test_missing_source_binding_and_unknown_token_fail(self):
        validate_references(self.data,self.authored)
        changed=copy.deepcopy(self.authored)
        section=next(s for s in changed[14]['sections'] if s['id']=='faire')
        section['html']=section['html'].replace('{{verb:present-faire:0}}','fais')
        with self.assertRaises(AssertionError):validate_references(self.data,changed)
        section['html']='{{verb:unknown-id:0}}'
        with self.assertRaises(AssertionError):expand_lesson(changed[14],self.data['records'])

if __name__=='__main__':unittest.main()
