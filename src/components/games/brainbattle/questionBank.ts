// Original question bank for تحدّي العقول (Brain Battle).
//
// This is a *starting* bank, not an exhaustive one — ~85 hand-written questions across
// 6 challenge types. It's deliberately sized for a genuinely working, fact-checked v1
// rather than padded with filler: every mcq_general item below sticks to extremely
// well-established, verifiable facts (capitals, standard historical dates, textbook
// science), every proverb is a widely-attested canonical one quoted as commonly known
// (not a rare/disputed variant), and every riddle is original/self-consistent rather than
// a claimed folk attribution I can't verify. Adding more later is just appending objects
// here — `battleLogic.ts` never needs to change.
//
// Deliberately excluded from v1: image-based questions (ماذا ترى؟) — needs real,
// licensed image assets this project doesn't have — and true semantic-embedding "secret
// word" proximity (Contexto's actual mechanic) — needs a word-embedding model/vector
// backend this stack has no infrastructure for. "الكلمة المخفية" below is the simpler,
// infra-free progressive-clue variant the brief also explicitly lists.

import type { Question } from './battleLogic';

const mcqGeneral: Question[] = [
  { id: 'g1', type: 'mcq_general', difficulty: 'medium', category: 'جغرافيا', prompt: 'ما عاصمة أستراليا؟', options: ['سيدني', 'ملبورن', 'كانبيرا', 'بريزبن'], correctIndex: 2, explanation: 'كانبيرا هي العاصمة الفعلية، رغم أن سيدني أكبر مدينة وأشهرها.' },
  { id: 'g2', type: 'mcq_general', difficulty: 'hard', category: 'أدب', prompt: 'من مؤلف رواية "مدن الملح"؟', options: ['نجيب محفوظ', 'غسان كنفاني', 'عبد الرحمن منيف', 'الطيب صالح'], correctIndex: 2, explanation: 'عبد الرحمن منيف كتب هذه الخماسية الروائية الشهيرة عن اكتشاف النفط في الجزيرة العربية.' },
  { id: 'g3', type: 'mcq_general', difficulty: 'easy', category: 'جغرافيا', prompt: 'ما أطول نهر في العالم حسب القياسات التقليدية؟', options: ['الأمازون', 'النيل', 'المسيسيبي', 'اليانغتسي'], correctIndex: 1, explanation: 'نهر النيل يُعد تقليديًا أطول أنهار العالم بطول يتجاوز 6600 كم.' },
  { id: 'g4', type: 'mcq_general', difficulty: 'medium', category: 'علوم', prompt: 'كم عدد عظام جسم الإنسان البالغ؟', options: ['186', '206', '226', '246'], correctIndex: 1, explanation: 'يمتلك جسم الإنسان البالغ 206 عظمة، رغم أن الرضيع يولد بعظام أكثر تندمج لاحقًا.' },
  { id: 'g5', type: 'mcq_general', difficulty: 'easy', category: 'علوم', prompt: 'من يُنسب إليه اختراع المصباح الكهربائي العملي؟', options: ['نيكولا تسلا', 'توماس إديسون', 'ألكسندر غراهام بيل', 'بنجامين فرانكلين'], correctIndex: 1, explanation: 'طوّر توماس إديسون أول مصباح كهربائي عملي وقابل للتسويق سنة 1879.' },
  { id: 'g6', type: 'mcq_general', difficulty: 'hard', category: 'تاريخ', prompt: 'ما عاصمة اليابان الإمبراطورية قبل أن تصبح طوكيو عاصمة؟', options: ['أوساكا', 'كيوتو', 'ناغويا', 'يوكوهاما'], correctIndex: 1, explanation: 'كانت كيوتو العاصمة الإمبراطورية لليابان لأكثر من ألف عام قبل انتقال العاصمة إلى طوكيو سنة 1868.' },
  { id: 'g7', type: 'mcq_general', difficulty: 'easy', category: 'جغرافيا', prompt: 'في أي قارة تقع صحراء گوبي؟', options: ['أفريقيا', 'آسيا', 'أستراليا', 'أمريكا الجنوبية'], correctIndex: 1, explanation: 'تمتد صحراء گوبي عبر شمال الصين ومنغوليا في قارة آسيا.' },
  { id: 'g8', type: 'mcq_general', difficulty: 'easy', category: 'أدب', prompt: 'من كتب ملحمة "الإلياذة"؟', options: ['هوميروس', 'فرجيل', 'سوفوكليس', 'أرسطو'], correctIndex: 0, explanation: 'هوميروس هو الشاعر الإغريقي الذي يُنسب إليه تأليف الإلياذة والأوديسة.' },
  { id: 'g9', type: 'mcq_general', difficulty: 'medium', category: 'علوم', prompt: 'ما الرمز الكيميائي لعنصر الذهب؟', options: ['Ag', 'Au', 'Fe', 'Gd'], correctIndex: 1, explanation: 'الرمز Au مشتق من الكلمة اللاتينية "Aurum" وتعني الذهب.' },
  { id: 'g10', type: 'mcq_general', difficulty: 'easy', category: 'علوم', prompt: 'أي الكواكب يُعرف بـ"الكوكب الأحمر"؟', options: ['الزهرة', 'المريخ', 'المشتري', 'زحل'], correctIndex: 1, explanation: 'يُعزى اللون الأحمر لكوكب المريخ إلى أكسيد الحديد المنتشر في تربته.' },
  { id: 'g11', type: 'mcq_general', difficulty: 'medium', category: 'تاريخ', prompt: 'من هو العالم المسلم الذي يُنسب إليه تأسيس علم الجبر؟', options: ['الخوارزمي', 'ابن سينا', 'الرازي', 'البيروني'], correctIndex: 0, explanation: 'تُشتق كلمة "algebra" من عنوان كتابه "الجبر والمقابلة".' },
  { id: 'g12', type: 'mcq_general', difficulty: 'easy', category: 'جغرافيا', prompt: 'ما اسم أكبر محيط في العالم مساحةً؟', options: ['المحيط الأطلسي', 'المحيط الهادئ', 'المحيط الهندي', 'المحيط المتجمد الشمالي'], correctIndex: 1, explanation: 'يغطي المحيط الهادئ وحده أكثر من ثلث مساحة سطح الأرض.' },
  { id: 'g13', type: 'mcq_general', difficulty: 'hard', category: 'تاريخ', prompt: 'في أي عام سقطت غرناطة آخر معاقل الوجود العربي في الأندلس؟', options: ['1453', '1492', '1517', '1258'], correctIndex: 1, explanation: 'سقطت غرناطة سنة 1492م في يد الملكين الكاثوليكيين، منهية قرونًا من الحكم العربي في الأندلس.' },
  { id: 'g14', type: 'mcq_general', difficulty: 'hard', category: 'تاريخ', prompt: 'أي علم يُعد ابن خلدون من روّاد تأسيسه في مقدّمته الشهيرة؟', options: ['علم الفلك', 'علم الاجتماع', 'علم الطب', 'علم الكيمياء'], correctIndex: 1, explanation: 'تُعد "المقدمة" من أوائل الأعمال التي أرست أسس دراسة العمران والمجتمع بمنهج تحليلي.' },
  { id: 'g15', type: 'mcq_general', difficulty: 'medium', category: 'فنون', prompt: 'أي آلة موسيقية يُطلق عليها لقب "ملكة الآلات الشرقية"؟', options: ['القانون', 'العود', 'الناي', 'الرق'], correctIndex: 1, explanation: 'يُلقّب العود بهذا اللقب لمكانته المحورية في الموسيقى العربية.' },
  { id: 'g16', type: 'mcq_general', difficulty: 'medium', category: 'جغرافيا', prompt: 'ما أصغر دولة في العالم من حيث المساحة؟', options: ['موناكو', 'الفاتيكان', 'ناورو', 'سان مارينو'], correctIndex: 1, explanation: 'تبلغ مساحة دولة الفاتيكان أقل من نصف كيلومتر مربع.' },
  { id: 'g17', type: 'mcq_general', difficulty: 'expert', category: 'علوم', prompt: 'ما وحدة قياس شدة التيار الكهربائي؟', options: ['الفولت', 'الأوم', 'الأمبير', 'الواط'], correctIndex: 2, explanation: 'يقاس التيار الكهربائي بالأمبير، نسبةً للعالم الفرنسي أندريه ماري أمبير.' },
  { id: 'g18', type: 'mcq_general', difficulty: 'expert', category: 'أدب', prompt: 'من أول عربي يفوز بجائزة نوبل في الأدب؟', options: ['أدونيس', 'نجيب محفوظ', 'طه حسين', 'جبران خليل جبران'], correctIndex: 1, explanation: 'فاز نجيب محفوظ بجائزة نوبل في الأدب سنة 1988.' },
];

const mcqProverb: Question[] = [
  { id: 'p1', type: 'mcq_proverb', difficulty: 'easy', category: 'أمثال', prompt: '"الصبر مفتاح ___"', options: ['الفرج', 'النجاح', 'الراحة', 'الأمل'], correctIndex: 0, explanation: 'مثل عربي شائع يحث على الصبر كطريق لتجاوز الشدائد.' },
  { id: 'p2', type: 'mcq_proverb', difficulty: 'easy', category: 'أمثال', prompt: '"العقل السليم في الجسم ___"', options: ['السليم', 'القوي', 'النشيط', 'الصحيح'], correctIndex: 0, explanation: 'مثل يربط بين الصحة الجسدية وسلامة التفكير.' },
  { id: 'p3', type: 'mcq_proverb', difficulty: 'medium', category: 'أمثال', prompt: '"من جدّ ___"', options: ['نجح', 'وجد', 'فاز', 'ربح'], correctIndex: 1, explanation: 'تتمة المثل: "من جدّ وجد، ومن زرع حصد".' },
  { id: 'p4', type: 'mcq_proverb', difficulty: 'medium', category: 'أمثال', prompt: '"درهم وقاية خير من قنطار ___"', options: ['مال', 'علاج', 'ذهب', 'دواء'], correctIndex: 1, explanation: 'يحث المثل على الوقاية المبكرة بدل انتظار العلاج الباهظ.' },
  { id: 'p5', type: 'mcq_proverb', difficulty: 'medium', category: 'أمثال', prompt: '"إذا كان الكلام من فضة فإن السكوت من ___"', options: ['ذهب', 'ياقوت', 'لؤلؤ', 'نور'], correctIndex: 0, explanation: 'مثل يُبرز قيمة الصمت أحيانًا أكثر من الكلام.' },
  { id: 'p6', type: 'mcq_proverb', difficulty: 'hard', category: 'أمثال', prompt: '"الوقت كالسيف إن لم تقطعه ___"', options: ['قطعك', 'ضاع', 'أهملته', 'فاتك'], correctIndex: 0, explanation: 'مثل يحذّر من إضاعة الوقت دون استثمار.' },
  { id: 'p7', type: 'mcq_proverb', difficulty: 'medium', category: 'أمثال', prompt: '"خير الكلام ما قلّ و___"', options: ['دلّ', 'صدق', 'وضح', 'أفاد'], correctIndex: 0, explanation: 'مثل يمتدح الإيجاز في الحديث.' },
  { id: 'p8', type: 'mcq_proverb', difficulty: 'easy', category: 'أمثال', prompt: '"يد واحدة لا ___"', options: ['تكفي', 'تصفق', 'تعمل', 'تبني'], correctIndex: 1, explanation: 'مثل يحث على التعاون، إذ لا يمكن للتصفيق أن يحدث بيد واحدة.' },
  { id: 'p9', type: 'mcq_proverb', difficulty: 'hard', category: 'أمثال', prompt: '"اتقِ شر من أحسنت ___"', options: ['إليه', 'معه', 'له', 'نحوه'], correctIndex: 0, explanation: 'مثل يتحدث عن نكران الجميل الذي قد يصدر ممن أحسنّا إليهم.' },
  { id: 'p10', type: 'mcq_proverb', difficulty: 'medium', category: 'أمثال', prompt: '"العين لا تعلو على ___"', options: ['الحاجب', 'الرأس', 'الجبين', 'الوجه'], correctIndex: 0, explanation: 'مثل يُضرب فيمن يتجاوز حدّه أو مكانته.' },
  { id: 'p11', type: 'mcq_proverb', difficulty: 'medium', category: 'أمثال', prompt: '"كما تدين ___"', options: ['تُدان', 'تُعامَل', 'تُجزى', 'تُكافأ'], correctIndex: 0, explanation: 'مثل يُشير إلى أن المعاملة ترتد على صاحبها.' },
  { id: 'p12', type: 'mcq_proverb', difficulty: 'easy', category: 'أمثال', prompt: '"في التأني السلامة وفي العجلة ___"', options: ['الندامة', 'الخسارة', 'الفشل', 'المتاعب'], correctIndex: 0, explanation: 'مثل يحث على التروي قبل اتخاذ القرارات.' },
  { id: 'p13', type: 'mcq_proverb', difficulty: 'hard', category: 'أمثال', prompt: '"لكل جواد ___"', options: ['كبوة', 'سقطة', 'عثرة', 'زلّة'], correctIndex: 0, explanation: 'مثل يعني أن حتى الأكفأ قد يُخطئ أحيانًا.' },
  { id: 'p14', type: 'mcq_proverb', difficulty: 'medium', category: 'أمثال', prompt: '"القناعة كنز لا ___"', options: ['يفنى', 'يُسرق', 'يُقاس', 'يُشترى'], correctIndex: 0, explanation: 'مثل يمتدح الرضا بما هو متاح باعتباره غنىً دائمًا.' },
];

const mcqConnection: Question[] = [
  { id: 'c1', type: 'mcq_connection', difficulty: 'easy', category: 'ما الرابط؟', prompt: 'ما الرابط بين: القاهرة، بغداد، دمشق، الرياض؟', options: ['عواصم عربية', 'مدن ساحلية', 'مدن أثرية فقط', 'عواصم أوروبية'], correctIndex: 0, explanation: 'كل هذه المدن هي عواصم لدول عربية (مصر، العراق، سوريا، السعودية).' },
  { id: 'c2', type: 'mcq_connection', difficulty: 'hard', category: 'ما الرابط؟', prompt: 'ما الرابط بين: النيل، الأمازون، المسيسيبي، اليانغتسي؟', options: ['أطول نهر في قارته', 'أنهار متجمدة شتاءً', 'أنهار من صنع الإنسان', 'تقع كلها في أوروبا'], correctIndex: 0, explanation: 'كل نهر منها هو الأطول (أو من الأطول) في قارته: أفريقيا، أمريكا الجنوبية، أمريكا الشمالية، آسيا.' },
  { id: 'c3', type: 'mcq_connection', difficulty: 'medium', category: 'ما الرابط؟', prompt: 'ما الرابط بين: ابن سينا، الرازي، الزهراوي، ابن النفيس؟', options: ['فلاسفة يونانيون', 'أطباء مسلمون بارزون', 'فلكيون معاصرون', 'شعراء جاهليون'], correctIndex: 1, explanation: 'جميعهم أطباء وعلماء مسلمون تركوا بصمة كبيرة في تاريخ الطب.' },
  { id: 'c4', type: 'mcq_connection', difficulty: 'easy', category: 'ما الرابط؟', prompt: 'ما الرابط بين: الفيل، الزرافة، وحيد القرن، فرس النهر؟', options: ['من أضخم الحيوانات البرية', 'حيوانات أليفة', 'حيوانات بحرية', 'حيوانات ليلية فقط'], correctIndex: 0, explanation: 'كلها من بين أضخم الثدييات البرية في العالم.' },
  { id: 'c5', type: 'mcq_connection', difficulty: 'medium', category: 'ما الرابط؟', prompt: 'ما الرابط بين: طه حسين، نجيب محفوظ، توفيق الحكيم، يوسف إدريس؟', options: ['أدباء مصريون روّاد', 'شعراء عراقيون', 'مؤرخون مغاربة', 'فنانون تشكيليون'], correctIndex: 0, explanation: 'جميعهم من أبرز الأدباء المصريين الذين شكّلوا الأدب العربي الحديث.' },
  { id: 'c6', type: 'mcq_connection', difficulty: 'medium', category: 'ما الرابط؟', prompt: 'ما الرابط بين: فيثاغورس، إقليدس، أرخميدس؟', options: ['علماء رياضيات في اليونان القديمة', 'فلاسفة صينيون', 'مخترعون عرب', 'أطباء رومان'], correctIndex: 0, explanation: 'جميعهم من علماء الرياضيات البارزين في الحضارة الإغريقية القديمة.' },
  { id: 'c7', type: 'mcq_connection', difficulty: 'hard', category: 'ما الرابط؟', prompt: 'ما الرابط بين: العربية، العبرية، الأمهرية، الآرامية؟', options: ['لغات سامية', 'لغات لاتينية', 'لغات هندوأوروبية', 'لغات معزولة لا تنتمي لعائلة'], correctIndex: 0, explanation: 'تنتمي جميعها إلى عائلة اللغات السامية.' },
  { id: 'c8', type: 'mcq_connection', difficulty: 'easy', category: 'ما الرابط؟', prompt: 'ما الرابط بين: الذهب، الفضة، النحاس، الحديد؟', options: ['من المعادن المعروفة منذ العصور القديمة', 'معادن مشعّة', 'معادن صناعية حديثة', 'تُستخرج من النباتات'], correctIndex: 0, explanation: 'استخدم الإنسان هذه المعادن منذ آلاف السنين في الأدوات والحلي.' },
];

const scramble: Question[] = [
  { id: 's1', type: 'scramble', difficulty: 'easy', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'مدرسة', clues: ['مكان للتعلّم', 'يذهب إليه الطلاب يوميًا', 'خمسة أحرف'] },
  { id: 's2', type: 'scramble', difficulty: 'easy', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'حديقة', clues: ['مكان فيه أشجار وأزهار', 'للنزهة والراحة', 'خمسة أحرف'] },
  { id: 's3', type: 'scramble', difficulty: 'easy', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'مكتبة', clues: ['مكان يحتوي على الكتب', 'يمكن استعارة الكتب منه', 'خمسة أحرف'] },
  { id: 's4', type: 'scramble', difficulty: 'medium', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'استقلال', clues: ['عكس التبعية', 'تحتفل به الدول', 'سبعة أحرف'] },
  { id: 's5', type: 'scramble', difficulty: 'medium', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'مهندس', clues: ['مهنة تتطلب دراسة تقنية', 'يصمم المباني أو الآلات', 'ستة أحرف'] },
  { id: 's6', type: 'scramble', difficulty: 'medium', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'صحراء', clues: ['أرض قاحلة قليلة المطر', 'تكثر فيها الكثبان الرملية', 'خمسة أحرف'] },
  { id: 's7', type: 'scramble', difficulty: 'medium', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'تجربة', clues: ['اختبار لفكرة أو فرضية', 'يقوم بها العلماء في المختبر', 'خمسة أحرف'] },
  { id: 's8', type: 'scramble', difficulty: 'medium', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'حضارة', clues: ['تطور فكري ومادي لمجتمع', 'لها آثار وتاريخ', 'خمسة أحرف'] },
  { id: 's9', type: 'scramble', difficulty: 'medium', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'ترابط', clues: ['قوة الصلة بين أجزاء', 'عكسه التفكك', 'خمسة أحرف'] },
  { id: 's10', type: 'scramble', difficulty: 'hard', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'استبصار', clues: ['فهم عميق ومفاجئ لأمر ما', 'يرتبط بالحدس والفطنة', 'سبعة أحرف'] },
  { id: 's11', type: 'scramble', difficulty: 'hard', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'انغماس', clues: ['الانخراط الكامل في أمر', 'عكسه الانسحاب أو التحفّظ', 'ستة أحرف'] },
  { id: 's12', type: 'scramble', difficulty: 'hard', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'ازدهار', clues: ['نمو وتوسع إيجابي', 'يُقال عن الاقتصاد أو الحضارة', 'ستة أحرف'] },
  { id: 's13', type: 'scramble', difficulty: 'hard', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'تماسك', clues: ['قوة الترابط بين الأجزاء', 'يوصف به الجسم أو الجماعة', 'خمسة أحرف'] },
  { id: 's14', type: 'scramble', difficulty: 'expert', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'استقصاء', clues: ['بحث دقيق ومتعمق', 'يقوم به الصحفي أو الباحث', 'سبعة أحرف'] },
  { id: 's15', type: 'scramble', difficulty: 'expert', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'انسلاخ', clues: ['الانفصال التام عن شيء كان جزءًا منه', 'يُستخدم مجازًا للتخلي عن هوية أو جماعة', 'ستة أحرف'] },
  { id: 's16', type: 'scramble', difficulty: 'expert', category: 'تشكيل الكلمات', prompt: 'أعد ترتيب الحروف لتكوين كلمة', answer: 'تهافت', clues: ['تسرع وازدحام نحو أمر', 'ورد في عنوان كتاب فلسفي شهير لأبي حامد الغزالي', 'خمسة أحرف'] },
];

const hiddenWord: Question[] = [
  { id: 'h1', type: 'hidden_word', difficulty: 'easy', category: 'الكلمة المخفية', prompt: 'اكتشف الكلمة من التلميحات', answer: 'واحة', clues: ['مكان أخضر وسط الصحراء', 'يحتوي عادة على نخيل ومياه', 'يبدأ بحرف الواو', 'أربعة أحرف فقط'] },
  { id: 'h2', type: 'hidden_word', difficulty: 'easy', category: 'الكلمة المخفية', prompt: 'اكتشف الكلمة من التلميحات', answer: 'غروب', clues: ['يحدث في نهاية اليوم', 'عكسه الشروق', 'تتلوّن فيه السماء بألوان دافئة', 'خمسة أحرف'] },
  { id: 'h3', type: 'hidden_word', difficulty: 'medium', category: 'الكلمة المخفية', prompt: 'اكتشف الكلمة من التلميحات', answer: 'صدفة', clues: ['حدث غير متوقع', 'يجمع بين أمرين دون تخطيط مسبق', 'يُقال أحيانًا "لا وجود لها"', 'خمسة أحرف'] },
  { id: 'h4', type: 'hidden_word', difficulty: 'easy', category: 'الكلمة المخفية', prompt: 'اكتشف الكلمة من التلميحات', answer: 'مرآة', clues: ['تعكس كل ما أمامها', 'نستخدمها لرؤية أنفسنا', 'قد تُستخدم مجازًا لوصف شخص صادق', 'أربعة أحرف'] },
  { id: 'h5', type: 'hidden_word', difficulty: 'medium', category: 'الكلمة المخفية', prompt: 'اكتشف الكلمة من التلميحات', answer: 'ذاكرة', clues: ['نخزّن فيها كل ما نعيشه', 'قد تخون صاحبها أحيانًا', 'منها ما هو قريب المدى ومنها بعيد', 'خمسة أحرف'] },
  { id: 'h6', type: 'hidden_word', difficulty: 'medium', category: 'الكلمة المخفية', prompt: 'اكتشف الكلمة من التلميحات', answer: 'بوصلة', clues: ['أداة تدل على الاتجاهات', 'إبرتها تشير دائمًا نحو الشمال', 'يستخدمها البحارة والمسافرون', 'ستة أحرف'] },
  { id: 'h7', type: 'hidden_word', difficulty: 'easy', category: 'الكلمة المخفية', prompt: 'اكتشف الكلمة من التلميحات', answer: 'شجاعة', clues: ['صفة لمن يواجه الخوف', 'ليست غياب الخوف بل التغلب عليه', 'عكسها الجبن', 'خمسة أحرف'] },
  { id: 'h8', type: 'hidden_word', difficulty: 'medium', category: 'الكلمة المخفية', prompt: 'اكتشف الكلمة من التلميحات', answer: 'فراشة', clues: ['كائن يبدأ حياته يرقة', 'له أجنحة ملونة', 'يرمز أحيانًا للتحول', 'خمسة أحرف'] },
  { id: 'h9', type: 'hidden_word', difficulty: 'hard', category: 'الكلمة المخفية', prompt: 'اكتشف الكلمة من التلميحات', answer: 'سراب', clues: ['ظاهرة بصرية تحدث في الصحراء', 'يبدو كالماء من بعيد لكنه وهم', 'يُستخدم مجازًا للأماني المستحيلة', 'أربعة أحرف'] },
  { id: 'h10', type: 'hidden_word', difficulty: 'easy', category: 'الكلمة المخفية', prompt: 'اكتشف الكلمة من التلميحات', answer: 'جسر', clues: ['يربط بين ضفتين', 'قد يكون حجريًا أو معلقًا', 'يُستخدم مجازًا للتقارب بين الثقافات', 'ثلاثة أحرف'] },
  { id: 'h11', type: 'hidden_word', difficulty: 'medium', category: 'الكلمة المخفية', prompt: 'اكتشف الكلمة من التلميحات', answer: 'همسة', clues: ['كلام يُقال بصوت خافت جدًا', 'لا يسمعه إلا من بجانبك', 'ترتبط أحيانًا بالأسرار', 'أربعة أحرف'] },
  { id: 'h12', type: 'hidden_word', difficulty: 'hard', category: 'الكلمة المخفية', prompt: 'اكتشف الكلمة من التلميحات', answer: 'قافلة', clues: ['مجموعة مسافرين يسيرون معًا', 'كانت تُستخدم قديمًا لعبور الصحراء بالجمال', 'ارتبطت بطرق التجارة القديمة', 'خمسة أحرف'] },
];

const riddle: Question[] = [
  { id: 'r1', type: 'riddle', difficulty: 'easy', category: 'لغز', prompt: 'شيء كلما أخذت منه كبر حجمه، فما هو؟', answer: 'الحفرة', altAnswers: ['حفرة'], clues: ['فكّر في الأرض', 'كلما حفرت أكثر زاد اتساعه', 'ليس شيئًا ماديًا تحمله'] },
  { id: 'r2', type: 'riddle', difficulty: 'easy', category: 'لغز', prompt: 'له أسنان كثيرة ولا يعضّ أحدًا، فما هو؟', answer: 'المشط', altAnswers: ['مشط'], clues: ['تستخدمه يوميًا تقريبًا', 'يُستخدم للشعر', 'أداة صغيرة بسيطة'] },
  { id: 'r3', type: 'riddle', difficulty: 'medium', category: 'لغز', prompt: 'ما الذي كلما قصصته طال؟', answer: 'الظفر', altAnswers: ['الأظافر', 'أظافر', 'ظفر'], clues: ['جزء من جسمك', 'ينمو باستمرار', 'تقصّه بين الحين والآخر'] },
  { id: 'r4', type: 'riddle', difficulty: 'medium', category: 'لغز', prompt: 'بيت لا أبواب له ولا نوافذ، ومع ذلك يسكنه كائن حي، فما هو؟', answer: 'البيضة', altAnswers: ['بيضة'], clues: ['شكله بيضاوي', 'يأتي منه كائن صغير لاحقًا', 'قشرته هشّة'] },
  { id: 'r5', type: 'riddle', difficulty: 'easy', category: 'لغز', prompt: 'يسبح طوال حياته، لكنه يموت إن خرج من الماء، فما هو؟', answer: 'السمك', altAnswers: ['سمكة', 'سمك'], clues: ['كائن بحري', 'يتنفس بالخياشيم', 'يُصطاد أحيانًا للطعام'] },
  { id: 'r6', type: 'riddle', difficulty: 'hard', category: 'لغز', prompt: 'لي رأس بلا عقل، وجسدي طويل ورفيع، أساعد في خياطة الثياب، فما أنا؟', answer: 'الإبرة', altAnswers: ['إبرة'], clues: ['أداة صغيرة ومعدنية', 'يصاحبها خيط', 'توجد في أدوات الخياطة'] },
  { id: 'r7', type: 'riddle', difficulty: 'hard', category: 'لغز', prompt: 'كل من يشتريه لا يستخدمه بنفسه، وكل من يستخدمه لا يعرف أنه اشتُري، فما هو؟', answer: 'القبر', altAnswers: ['قبر'], clues: ['يرتبط بنهاية الحياة', 'يُشترى عادة من قِبل الأهل', 'مكان أخير يستقر فيه الإنسان'] },
  { id: 'r8', type: 'riddle', difficulty: 'medium', category: 'لغز', prompt: 'أسير مع الناس طوال النهار ثم أختفي في الليل، فما أنا؟', answer: 'الظل', altAnswers: ['ظل'], clues: ['يتبعك أينما ذهبت في النور', 'لونه داكن دائمًا', 'يختفي في الظلام التام'] },
  { id: 'r9', type: 'riddle', difficulty: 'expert', category: 'لغز', prompt: 'كل إنسان يملكه، ولا أحد يستطيع رؤيته بنفسه مباشرة دون وسيط، فما هو؟', answer: 'الوجه', altAnswers: ['وجه', 'وجهه'], clues: ['جزء مميز من جسمك', 'تحتاج مرآة لرؤيته', 'يحمل ملامحك الخاصة'] },
  { id: 'r10', type: 'riddle', difficulty: 'medium', category: 'لغز', prompt: 'أُصنع من الطين، وأُحرق بالنار لأصبح أقوى، وأُستخدم في بناء المنازل، فما أنا؟', answer: 'الطوب', altAnswers: ['طوب', 'الآجر', 'آجر'], clues: ['مادة بناء قديمة', 'شكله مستطيل غالبًا', 'يُرص فوق بعضه لبناء الجدران'] },
  { id: 'r11', type: 'riddle', difficulty: 'easy', category: 'لغز', prompt: 'أتكوّن في السماء من قطرات الماء، وألوّن الأفق بعد المطر بألوان عدة، فما أنا؟', answer: 'قوس قزح', altAnswers: ['قوس المطر', 'قوسقزح'], clues: ['يظهر بعد المطر غالبًا', 'له سبعة ألوان تقليديًا', 'شكله منحني كالقوس'] },
  { id: 'r12', type: 'riddle', difficulty: 'medium', category: 'لغز', prompt: 'أحمل أخبارًا كثيرة لكن لا صوت لي، ويقرأني الناس كل صباح، فما أنا؟', answer: 'الجريدة', altAnswers: ['جريدة', 'الصحيفة', 'صحيفة'], clues: ['مطبوعة ورقية', 'تصدر يوميًا غالبًا', 'تحتوي أخبارًا ومقالات'] },
];

export const QUESTION_BANK: Question[] = [...mcqGeneral, ...mcqProverb, ...mcqConnection, ...scramble, ...hiddenWord, ...riddle];
