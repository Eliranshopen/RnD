# card 11: home-page strings (drafts in the house tone; listed in CHANGES.md for Eliran). One-shot.
p = r"C:\RnD\.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\platform\js\i18n.js"
s = open(p, encoding="utf-8").read()
HE = """    'index.foot': 'Habait · v0 · תצוגת פיתוח',
    // platform-ui-ux card 11: the home page (copy = draft for Eliran)
    'home.hero': 'סיור בבניין, לפני שהוא קם.',
    'home.heroSub': 'טיסה סביב הפרויקט, בחירת דירה מתוך הטיסה, וכניסה פנימה.',
    'home.projects': 'הפרויקטים',
    'home.units': '{n} דירות',
    'home.available': '{n} פנויות',
    'home.cta': 'לסיור בפרויקט',
    'home.emptyTitle': 'עוד אין פרויקטים להצגה',
    'home.emptyText': 'כאן יופיעו הפרויקטים שבשיווק, כל אחד עם טיסה סביב הבניין וסיור בדירות.',
    'home.emptyCta': 'לנסות שוב',
    'home.ai': 'הדמיה',
    'home.foot': 'Habait · סיורים בפרויקטים שעוד לא נבנו',"""
EN = """    'index.foot': 'Habait · v0 · development view',
    'home.hero': 'Walk through a building before it rises.',
    'home.heroSub': 'Fly around the project, pick an apartment from the flight, and step inside.',
    'home.projects': 'Projects',
    'home.units': '{n} apartments',
    'home.available': '{n} available',
    'home.cta': 'Tour the project',
    'home.emptyTitle': 'No projects to show yet',
    'home.emptyText': 'Projects on sale will appear here, each with a flight around the building and tours of its apartments.',
    'home.emptyCta': 'Try again',
    'home.ai': 'Visualization',
    'home.foot': 'Habait · tours of projects not built yet',"""
for old, new in ((HE.split("\n")[0], HE), (EN.split("\n")[0], EN)):
    assert s.count(old) == 1, old
    s = s.replace(old, new)
open(p, "w", encoding="utf-8", newline="").write(s)
print("i18n patched")
