import unittest
from sync_rules import parse_module, references, rule_count


class SyncRulesTests(unittest.TestCase):
    def test_rejects_error_pages_and_unknown_sections(self):
        for text in ('<html>Not found</html>', '[Unknown]\ninvalid', '#!name=empty'):
            with self.assertRaises(ValueError):
                parse_module(text)

    def test_metadata_and_active_count(self):
        meta, sections = parse_module('#!arguments=enabled:true\n[Rule]\n#comment\nDOMAIN,ads.example.com,REJECT\n[MITM]\nhostname = %APPEND% example.com')
        self.assertEqual(meta['arguments'], 'enabled:true')
        self.assertEqual(rule_count(sections), 1)

    def test_inactive_mitm_only_source(self):
        _, sections = parse_module('[MITM]\nhostname = %APPEND% example.com')
        self.assertEqual(rule_count(sections), 0)

    def test_only_active_dependency_urls(self):
        sections = {'Script': ['# https://raw.githubusercontent.com/owner/repo/main/old.js',
                               'x = script-path=https://raw.githubusercontent.com/owner/repo/main/new.js',
                               'pattern=^https://api.example.com/a.*']}
        self.assertEqual(references(sections), {'https://raw.githubusercontent.com/owner/repo/main/new.js'})


if __name__ == '__main__':
    unittest.main()
