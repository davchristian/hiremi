const INTERNSHIP =
  /\b(?:interns?|internships?|co-?ops?|working students?|werkstudent(?:in)?|placements?|apprentices?|apprenticeships?|magang|kerja praktik)\b|インターン|實習|实习/i;

const TECHNICAL_TITLE =
  /\b(?:software|engineer(?:s|ing)?|developers?|software development|programm(?:er|ing)|coding|data|machine learning|(?<!\.)ml|(?<!\.)ai|artificial intelligence|deep learning|nlp|computer vision|llms?|research(?:er)?|scientists?|platform|infrastructure|cloud|devops|sre|site reliability|security|cyber ?security|qa|quality assurance|test(?:ing)? automation|sdet|mobile|ios|android|web|front[- ]?end|back[- ]?end|full[- ]?stack|algorithms?|computer science)\b|\bIT\b|ソフトウェア|エンジニア|開発|データ|機械学習|软件|軟體|工程师|工程師|开发|開發|数据|數據/i;

const TECHNICAL_DEPARTMENT =
  /\b(?:software|engineering|data|machine learning|ai|research|platform|infrastructure|security|qa|mobile|web|devops|technology|tech)\b/i;

const NON_SOFTWARE =
  /\b(?:sales|sdr|bdr|marketing|business development|account (?:manager|executive)|partnerships?|lead generat\w*|finance|financial|accounting|audit|tax|legal|compliance|policy|public affairs|government affairs|hr|human resources|people (?:ops|operations|partner)|recruit(?:er|ing|ment)|talent acquisition|operations|customer|support|community|events?|content|social media|communications?|public relations|pr|copywrit(?:er|ing)|editorial|journalis[mt]|curriculum|teaching|tutor|learning and development|graphic|brand|merchandis(?:er|ing)|procurement|supply chain|logistics|admin(?:istrative)?|strategy|investment|investor|banking|insurance|real estate|retail|store|warehouse|field service|health|safety|environment(?:al)?|hse|clinical|medical|nursing|pharmac\w*|mechanical|electrical|civil|chemical|structural|hardware|manufacturing|industrial|biomedical|aerospace|map operations|fundrais\w*|ministry)\b/i;

const SOFTWARE_OVERRIDE =
  /\b(?:software|developers?|programm(?:er|ing)|machine learning|(?<!\.)ml|(?<!\.)ai|data (?:engineer(?:ing)?|scien(?:ce|tist))|full[- ]?stack|back[- ]?end|front[- ]?end|mobile|web)\b/i;

export type RoleFields = {
  title: string;
  department?: string | null;
  employmentType?: string | null;
};

export function isInternship({ title, employmentType }: RoleFields): boolean {
  return INTERNSHIP.test(title) || INTERNSHIP.test(employmentType ?? "");
}

export function isTechnical({ title, department }: RoleFields): boolean {
  return TECHNICAL_TITLE.test(title) || TECHNICAL_DEPARTMENT.test(department ?? "");
}

export function isClearlyNonSoftware({ title }: RoleFields): boolean {
  return NON_SOFTWARE.test(title) && !SOFTWARE_OVERRIDE.test(title);
}

export function isSoftwareInternship(fields: RoleFields): boolean {
  return isInternship(fields) && isTechnical(fields) && !isClearlyNonSoftware(fields);
}
