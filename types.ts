
export enum Grade {
  GRADE_1 = 'Lớp 1',
  GRADE_2 = 'Lớp 2',
  GRADE_3 = 'Lớp 3',
  GRADE_4 = 'Lớp 4',
  GRADE_5 = 'Lớp 5',
  MIDDLE_SCHOOL = 'Lớp 6-8'
}

export enum Subject {
  MATH = 'Toán',
  VIETNAMESE = 'Tiếng Việt',
  ENGLISH = 'Tiếng Anh',
  IT = 'Tin Học',
  TECH = 'Công Nghệ',
  HISTORY_GEOGRAPHY = 'Lịch Sử & Địa Lý',
  SCIENCE = 'Khoa Học'
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Hình ảnh người dùng gửi lên
  generatedImages?: string[]; // Hình ảnh AI tạo ra để minh họa
  generatedVideo?: string; // Video AI tạo ra
  isAudio?: boolean;
}

export interface UserSettings {
  grade: Grade;
  persona: 'normal' | 'shy';
  addressMode: 'con' | 'em';
  teacherGender: 'Thầy' | 'Cô';
}
