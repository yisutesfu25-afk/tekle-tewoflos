import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
Users, BookOpen, Shield, Lock, Unlock, UserPlus, CheckCircle,
LogOut, Award, FileText, Trash2, AlertCircle, Key, Eye, EyeOff,
Search, Award as Trophy, Save, Check, X, Cloud, Loader2, CalendarCheck, RefreshCw
} from 'lucide-react';
​// ============================================================================
// 👇 YOUR GOOGLE APPS SCRIPT WEB APP URL (CONNECTED!)
// ============================================================================
const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwXqV2vI2e825s0u26F9rJ-3-q7vVb8sH7u4m18Y2c7Q8oXyR3s8d1n4v9c2m5b/exec";
​// --- INITIAL DEFAULT SUBJECTS ---
const DEFAULT_SUBJECTS = [
'ትምህርተ ሃይማኖት (Doctrine)',
'መጽሐፍ ቅዱስ ጥናት (Bible Study)',
'የቤተክርስቲያን ታሪክ (Church History)',
'ሥርዓተ ቤተክርስቲያን (Liturgy & Order)',
'ክርስቲያናዊ ሥነ ምግባር (Christian Ethics)',
'ልሳነ ግእዝ (Ge’ez Language)'
];
​const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
​const INITIAL_USERS = [
{
id: 'superadmin-1',
username: 'admin',
password: '123',
fullName: 'ዋና አስተዳዳሪ (Super Admin)',
role: 'SUPER_ADMIN',
permissions: ['ALL'],
assignedGrade: null,
assignedSubject: null
}
];
​// --- HELPER: AMHARIC ALPHABETICAL SORT ---
const sortAmharic = (list) => {
return [...list].sort((a, b) => a.fullName.localeCompare(b.fullName, 'am'));
};
​// --- HELPER: CALCULATE SINGLE SUBJECT TOTAL ---
const calculateSubjectTotal = (markObj) => {
if (!markObj) return 0;
const a = Number(markObj.assignment) || 0;
const m = Number(markObj.mid) || 0;
const t = Number(markObj.test) || 0;
const att = Number(markObj.attendance) || 0;
const f = Number(markObj.final) || 0;
return Number((a + m + t + att + f).toFixed(2));
};
​// --- HELPER: LOCAL STORAGE CACHE ---
const CACHE_KEY = 'tekle_tewoflos_sheet_cache_v1';
const loadCache = () => {
try {
const raw = localStorage.getItem(CACHE_KEY);
return raw ? JSON.parse(raw) : null;
} catch {
return null;
}
};
const saveCache = (data) => {
try {
localStorage.setItem(CACHE_KEY, JSON.stringify(data));
} catch {
// ignore quota errors
}
};
​export default function App() {
const isSheetConfigured = Boolean(GOOGLE_SHEET_API_URL && GOOGLE_SHEET_API_URL.startsWith('http'));
​const [isLoadingCloud, setIsLoadingCloud] = useState(true);
const [isSyncing, setIsSyncing] = useState(false);
​// School User Session State
const [currentUser, setCurrentUser] = useState(null);
const [activeTab, setActiveTab] = useState('DASHBOARD');
​// Core Database State (Synced with Google Sheets)
const [users, setUsers] = useState(INITIAL_USERS);
const [students, setStudents] = useState([]);
const [marks, setMarks] = useState({});
const [lockedLists, setLockedLists] = useState({});
const [attendanceRecords, setAttendanceRecords] = useState({});
const [auditLogs, setAuditLogs] = useState([]);
const [subjects] = useState(DEFAULT_SUBJECTS);
​// Notification Banner State
const [toast, setToast] = useState(null);
const [confirmModal, setConfirmModal] = useState(null);
​const showToast = (message, type = 'success') => {
setToast({ message, type });
setTimeout(() => setToast(null), 4000);
};
​// --- HELPER: POST ACTION TO GOOGLE SHEET ---
const postToSheet = async (collectionName, action, id, item = null) => {
if (!isSheetConfigured) return;
setIsSyncing(true);
try {
await fetch(GOOGLE_SHEET_API_URL, {
method: 'POST',
mode: 'no-cors',
headers: { 'Content-Type': 'text/plain;charset=utf-8' },
body: JSON.stringify({
action,
collection: collectionName,
id,
item
})
});
} catch (err) {
console.error('Google Sheet write error:', err);
showToast('ወደ Google Sheet በማስቀመጥ ላይ ችግር ተፈጥሯል (Check Internet)', 'error');
} finally {
setIsSyncing(false);
}
};
​// --- FETCH ALL DATA FROM GOOGLE SHEET ---
const fetchAllFromSheet = useCallback(async (silent = false) => {
if (!isSheetConfigured) {
const cached = loadCache();
if (cached) {
setUsers(cached.users?.length ? cached.users : INITIAL_USERS);
setStudents(cached.students || []);
setMarks(cached.marks || {});
setLockedLists(cached.lockedLists || {});
setAttendanceRecords(cached.attendanceRecords || {});
setAuditLogs(cached.auditLogs || []);
}
setIsLoadingCloud(false);
return;
}
​if (!silent) setIsSyncing(true);
try {
const response = await fetch(GOOGLE_SHEET_API_URL);
const data = await response.json();
​// Users
const fetchedUsers = Array.isArray(data.users) && data.users.length > 0 ? data.users : INITIAL_USERS;
if (!data.users || data.users.length === 0) {
for (const u of INITIAL_USERS) {
await postToSheet('users', 'SAVE', u.id, u);
}
}
setUsers(fetchedUsers);
​// Students
const fetchedStudents = Array.isArray(data.students) ? data.students : [];
setStudents(fetchedStudents);
​// Marks
const marksMap = {};
if (Array.isArray(data.marks)) {
data.marks.forEach(entry => {
if (entry && entry.studentId) {
marksMap[entry.studentId] = entry.subjects || {};
}
});
}
setMarks(marksMap);
​// Locks
const locksMap = {};
if (Array.isArray(data.locks)) {
data.locks.forEach(entry => {
if (entry && entry.key) {
locksMap[entry.key] = Boolean(entry.locked);
}
});
}
setLockedLists(locksMap);
​// Attendance
const attMap = {};
if (Array.isArray(data.attendance)) {
data.attendance.forEach(entry => {
if (entry && entry.docId) {
attMap[entry.docId] = entry;
}
});
}
setAttendanceRecords(attMap);
​// Audit Logs
const fetchedLogs = Array.isArray(data.logs)
? [...data.logs].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
: [];
setAuditLogs(fetchedLogs);
​saveCache({
users: fetchedUsers,
students: fetchedStudents,
marks: marksMap,
lockedLists: locksMap,
attendanceRecords: attMap,
auditLogs: fetchedLogs
});
} catch (err) {
console.error('Google Sheet read error:', err);
const cached = loadCache();
if (cached) {
setUsers(cached.users?.length ? cached.users : INITIAL_USERS);
setStudents(cached.students || []);
setMarks(cached.marks || {});
setLockedLists(cached.lockedLists || {});
setAttendanceRecords(cached.attendanceRecords || {});
setAuditLogs(cached.auditLogs || []);
}
if (!silent) {
showToast('ከGoogle Sheet ዳታ ማንበብ አልተቻለም። URL እና Internet ያረጋግጡ።', 'error');
}
} finally {
setIsLoadingCloud(false);
setIsSyncing(false);
}
}, [isSheetConfigured]);
​useEffect(() => {
fetchAllFromSheet(false);
}, [fetchAllFromSheet]);
​useEffect(() => {
if (!isLoadingCloud) {
saveCache({ users, students, marks, lockedLists, attendanceRecords, auditLogs });
}
}, [users, students, marks, lockedLists, attendanceRecords, auditLogs, isLoadingCloud]);
​const logActivityToCloud = async (actorName, actorRole, actionType, details) => {
const logEntry = {
id: log-${Date.now()}-${Math.random().toString(36).slice(2, 6)},
actorName: actorName || 'System',
actorRole: actorRole || 'UNKNOWN',
actionType,
details,
timestamp: new Date().toISOString()
};
setAuditLogs(prev => [logEntry, ...prev]);
await postToSheet('logs', 'SAVE', logEntry.id, logEntry);
};
​const saveStudentToCloud = async (studentObj) => {
setStudents(prev => [...prev, studentObj]);
await postToSheet('students', 'SAVE', studentObj.id, studentObj);
await logActivityToCloud(
currentUser?.fullName,
currentUser?.role,
'STUDENT_REGISTERED',
ተማሪ "${studentObj.fullName}" በ${studentObj.grade}ኛ ክፍል ተመዝግቧል።
);
};
​const deleteStudentFromCloud = async (studentId) => {
const targetStu = students.find(s => s.id === studentId);
setStudents(prev => prev.filter(s => s.id !== studentId));
setMarks(prev => {
const copy = { ...prev };
delete copy[studentId];
return copy;
});
await postToSheet('students', 'DELETE', studentId);
await postToSheet('marks', 'DELETE', studentId);
await logActivityToCloud(
currentUser?.fullName,
currentUser?.role,
'STUDENT_DELETED',
ተማሪ "${targetStu?.fullName || studentId}" (${targetStu?.grade || '?'}ኛ ክፍል) ተሰርዟል።
);
};
​const saveStudentSubjectMarkToCloud = async (studentId, subject, subjectMarkObj) => {
const existingStudentMarks = marks[studentId] || {};
const updatedSubjects = {
...existingStudentMarks,
[subject]: subjectMarkObj
};
setMarks(prev => ({
...prev,
[studentId]: updatedSubjects
}));
​await postToSheet('marks', 'SAVE', studentId, {
studentId,
subjects: updatedSubjects
});
​const stu = students.find(s => s.id === studentId);
const total = calculateSubjectTotal(subjectMarkObj);
await logActivityToCloud(
currentUser?.fullName,
currentUser?.role,
'MARK_UPDATED',
የተማሪ "${stu?.fullName || studentId}" (${stu?.grade || '?'}ኛ ክፍል - ${subject.split(' (')[0]}) ውጤት ተስተካክሏል (ድምር: ${total}%)።
);
};
​const saveLockStateToCloud = async (lockKey, lockedBool) => {
setLockedLists(prev => ({
...prev,
[lockKey]: lockedBool
}));
​await postToSheet('locks', 'SAVE', lockKey, {
key: lockKey,
locked: lockedBool
});
​const [g, sub] = lockKey.split('_');
await logActivityToCloud(
currentUser?.fullName,
currentUser?.role,
lockedBool ? 'MARKLIST_LOCKED' : 'MARKLIST_UNLOCKED',
${g}ኛ ክፍል - ${sub?.split(' (')[0] || sub} ውጤት መመዝገቢያ ${lockedBool ? 'ተረጋግጦ ተቆልፏል' : 'ተከፍቷል'}።
);
};
​const saveUserToCloud = async (userObj, customLogDetail = null) => {
setUsers(prev => {
const exists = prev.some(u => u.id === userObj.id);
return exists ? prev.map(u => (u.id === userObj.id ? userObj : u)) : [...prev, userObj];
});
await postToSheet('users', 'SAVE', userObj.id, userObj);
if (customLogDetail) {
await logActivityToCloud(currentUser?.fullName, currentUser?.role, 'ACCOUNT_UPDATED', customLogDetail);
}
};
​const deleteUserFromCloud = async (userId) => {
const targetUser = users.find(u => u.id === userId);
setUsers(prev => prev.filter(u => u.id !== userId));
await postToSheet('users', 'DELETE', userId);
await logActivityToCloud(
currentUser?.fullName,
currentUser?.role,
'ACCOUNT_DELETED',
የተጠቃሚ "${targetUser?.fullName || userId}" መለያ ተሰርዟል።
);
};
​const clearAllSampleDataFromCloud = async () => {
const oldStudents = [...students];
const oldUsers = [...users];
setStudents([]);
setMarks({});
setUsers(prev => prev.filter(u => u.role === 'SUPER_ADMIN'));
​for (const s of oldStudents) {
await postToSheet('students', 'DELETE', s.id);
await postToSheet('marks', 'DELETE', s.id);
}
for (const u of oldUsers) {
if (u.role !== 'SUPER_ADMIN') {
await postToSheet('users', 'DELETE', u.id);
}
}
await logActivityToCloud(
currentUser?.fullName,
currentUser?.role,
'SYSTEM_RESET',
'ሁሉም የሙከራ ተማሪዎች እና መምህራን ዳታ ጸድቷል።'
);
};
​const saveAttendanceToCloud = async (grade, dateStr, recordsMap) => {
const docId = ${grade}_${dateStr};
const payload = {
docId,
grade: Number(grade),
date: dateStr,
records: recordsMap,
updatedBy: currentUser?.fullName || 'System',
updatedAt: new Date().toISOString()
};
setAttendanceRecords(prev => ({
...prev,
[docId]: payload
}));
await postToSheet('attendance', 'SAVE', docId, payload);
await logActivityToCloud(
currentUser?.fullName,
currentUser?.role,
'ATTENDANCE_SAVED',
የ${grade}ኛ ክፍል የ${dateStr} ክትትል ተመዝግቧል።
);
};
​const hasPermission = (perm) => {
if (!currentUser) return false;
if (currentUser.role === 'SUPER_ADMIN') return true;
return currentUser.permissions?.includes(perm);
};
​const handleLogin = (username, password) => {
const found = users.find(
u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
);
if (!found) {
showToast('የተሳሳተ የተጠቃሚ ስም ወይም የይለፍ ቃል! (Invalid credentials)', 'error');
return;
}
setCurrentUser(found);
if (found.role === 'TEACHER') {
setActiveTab('MARK_ENTRY');
} else {
setActiveTab('DASHBOARD');
}
showToast(እንኳን ደህና መጡ፣ ${found.fullName}!);
};
​const handleLogout = () => {
setCurrentUser(null);
setActiveTab('DASHBOARD');
};
​const lockedCount = useMemo(() => {
return Object.values(lockedLists).filter(Boolean).length;
}, [lockedLists]);
​if (isLoadingCloud) {
return (
<div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
<Loader2 className="w-10 h-10 text-amber-700 animate-spin mb-3" />
<p className="text-slate-700 font-bold text-sm">ከGoogle Sheet ዳታ በመጫን ላይ ነው...</p>
</div>
);
}
​if (!currentUser) {
return (
<div className="min-h-screen bg-gradient-to-br from-amber-950 via-stone-900 to-amber-900 flex items-center justify-center p-4 font-sans">
{toast && <ToastBanner toast={toast} onClose={() => setToast(null)} />}
<LoginScreen onLogin={handleLogin} />
</div>
);
}
​return (
<div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
{toast && <ToastBanner toast={toast} onClose={() => setToast(null)} />}
{confirmModal && (
<ConfirmDialog
title={confirmModal.title}
message={confirmModal.message}
onConfirm={() => {
confirmModal.onConfirm();
setConfirmModal(null);
}}
onCancel={() => setConfirmModal(null)}
/>
)}
​<header className="bg-gradient-to-r from-amber-900 via-amber-800 to-stone-900 text-white shadow-lg sticky top-0 z-30">
<div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
<div className="flex items-center gap-3">
<div className="bg-amber-400/20 p-2.5 rounded-xl border border-amber-300/30">
<BookOpen className="w-6 h-6 text-amber-300" />
</div>
<div>
<h1 className="text-base sm:text-lg font-bold tracking-wide text-amber-50 leading-tight">
ተክለ ቴዎፍሎስ ሰ/ት/ቤት
</h1>
<div className="flex flex-wrap items-center gap-2">
<p className="text-xs text-amber-200/90">
ትምህርትና ሥልጠና ክፍል — የውጤት እና መረጃ መቆጣጠሪያ
</p>
<span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-300/30 text-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">
<Cloud className="w-3 h-3" /> {isSyncing ? 'Syncing...' : 'Google Sheet Connected'}
</span>
</div>
</div>
</div>
​<div className="flex items-center gap-2 sm:gap-3 ml-auto">
<button
onClick={() => {
fetchAllFromSheet(false);
showToast('ዳታው ከGoogle Sheet ታድሷል!');
}}
disabled={isSyncing}
className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-amber-100 px-2.5 py-2 rounded-xl text-xs font-semibold transition"
>
<RefreshCw className={w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}} />
<span className="hidden md:inline">አድስ</span>
</button>
​<div className="text-right hidden sm:block">
<div className="text-sm font-semibold text-white">{currentUser.fullName}</div>
<div className="text-xs text-amber-200">
{currentUser.role === 'SUPER_ADMIN' && 'ዋና አስተዳዳሪ'}
{currentUser.role === 'TEACHER' && ${currentUser.assignedGrade}ኛ ክፍል | ${currentUser.assignedSubject?.split(' (')[0]}}
</div>
</div>
<button
onClick={handleLogout}
className="flex items-center gap-1.5 bg-red-600/90 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow"
>
<LogOut className="w-4 h-4" />
<span>ውጣ</span>
</button>
</div>
</div>
​<nav className="bg-black/25 border-t border-white/10">
<div className="max-w-7xl mx-auto px-4 flex overflow-x-auto no-scrollbar gap-1 py-1.5">
<NavButton
active={activeTab === 'DASHBOARD'}
onClick={() => setActiveTab('DASHBOARD')}
icon={<Shield className="w-4 h-4" />}
label="አጠቃላይ እይታ"
/>
​{hasPermission('REGISTER_STUDENTS') && (
<NavButton
active={activeTab === 'REGISTRATION'}
onClick={() => setActiveTab('REGISTRATION')}
icon={<UserPlus className="w-4 h-4" />}
label="ተማሪዎች መመዝገቢያ"
/>
)}
​{(currentUser.role === 'TEACHER' || currentUser.role === 'SUPER_ADMIN') && (
<NavButton
active={activeTab === 'MARK_ENTRY'}
onClick={() => setActiveTab('MARK_ENTRY')}
icon={<FileText className="w-4 h-4" />}
label={currentUser.role === 'TEACHER' ? 'የእኔ ውጤት መመዝገቢያ' : 'ውጤት መመዝገቢያ (All)'}
/>
)}
​{(hasPermission('VIEW_ALL_REPORTS') || currentUser.role === 'SUPER_ADMIN') && (
<NavButton
active={activeTab === 'MASTER_REPORT'}
onClick={() => setActiveTab('MASTER_REPORT')}
icon={<Award className="w-4 h-4" />}
label="አጠቃላይ ውጤት እና ደረጃ (Rank)"
/>
)}
​{(hasPermission('MANAGE_ATTENDANCE') || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'TEACHER') && (
<NavButton
active={activeTab === 'ATTENDANCE'}
onClick={() => setActiveTab('ATTENDANCE')}
icon={<CalendarCheck className="w-4 h-4" />}
label="የተማሪዎች ክትትል (Attendance)"
/>
)}
​{hasPermission('UNLOCK_MARKS') && (
<NavButton
active={activeTab === 'UNLOCK_REQUESTS'}
onClick={() => setActiveTab('UNLOCK_REQUESTS')}
icon={<Lock className="w-4 h-4" />}
label={የተዘጉ ውጤቶች መፍቻ (${lockedCount})}
/>
)}
​{currentUser.role === 'SUPER_ADMIN' && (
<NavButton
active={activeTab === 'USER_MANAGEMENT'}
onClick={() => setActiveTab('USER_MANAGEMENT')}
icon={<Key className="w-4 h-4" />}
label="መምህራን እና ፈቃድ መቆጣጠሪያ"
/>
)}
​{currentUser.role === 'SUPER_ADMIN' && (
<NavButton
active={activeTab === 'AUDIT_LOGS'}
onClick={() => setActiveTab('AUDIT_LOGS')}
icon={<Eye className="w-4 h-4" />}
label={የእንቅስቃሴ መዝገብ (${auditLogs.length})}
/>
)}
​<NavButton
active={activeTab === 'ACCOUNT_SETTINGS'}
onClick={() => setActiveTab('ACCOUNT_SETTINGS')}
icon={<Shield className="w-4 h-4" />}
label="የእኔ መለያ (Change Password)"
/>
</div>
</nav>
</header>
​<main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
{activeTab === 'DASHBOARD' && (
<DashboardView
currentUser={currentUser}
students={students}
users={users}
subjects={subjects}
lockedLists={lockedLists}
setActiveTab={setActiveTab}
hasPermission={hasPermission}
/>
)}
​{activeTab === 'REGISTRATION' && hasPermission('REGISTER_STUDENTS') && (
<StudentRegistrationPanel
students={students}
onAddStudent={saveStudentToCloud}
onDeleteStudent={deleteStudentFromCloud}
grades={GRADES}
subjects={subjects}
showToast={showToast}
setConfirmModal={setConfirmModal}
/>
)}
​{activeTab === 'MARK_ENTRY' && (currentUser.role === 'TEACHER' || currentUser.role === 'SUPER_ADMIN') && (
<MarkEntryPanel
currentUser={currentUser}
students={students}
marks={marks}
onSaveStudentMark={saveStudentSubjectMarkToCloud}
lockedLists={lockedLists}
onToggleLock={saveLockStateToCloud}
grades={GRADES}
subjects={subjects}
showToast={showToast}
setConfirmModal={setConfirmModal}
/>
)}
​{activeTab === 'MASTER_REPORT' && (hasPermission('VIEW_ALL_REPORTS') || currentUser.role === 'SUPER_ADMIN') && (
<MasterReportPanel
students={students}
marks={marks}
grades={GRADES}
subjects={subjects}
/>
)}
​{activeTab === 'ATTENDANCE' && (hasPermission('MANAGE_ATTENDANCE') || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'TEACHER') && (
<AttendancePanel
currentUser={currentUser}
students={students}
attendanceRecords={attendanceRecords}
onSaveAttendance={saveAttendanceToCloud}
grades={GRADES}
showToast={showToast}
/>
)}
​{activeTab === 'UNLOCK_REQUESTS' && hasPermission('UNLOCK_MARKS') && (
<UnlockManagementPanel
lockedLists={lockedLists}
onToggleLock={saveLockStateToCloud}
users={users}
showToast={showToast}
/>
)}
​{activeTab === 'USER_MANAGEMENT' && currentUser.role === 'SUPER_ADMIN' && (
<UserManagementPanel
users={users}
onCreateUser={saveUserToCloud}
onUpdateUser={saveUserToCloud}
onDeleteUser={deleteUserFromCloud}
onClearSampleData={clearAllSampleDataFromCloud}
grades={GRADES}
subjects={subjects}
showToast={showToast}
setConfirmModal={setConfirmModal}
/>
)}
​{activeTab === 'AUDIT_LOGS' && currentUser.role === 'SUPER_ADMIN' && (
<AuditLogsPanel logs={auditLogs} />
)}
​{activeTab === 'ACCOUNT_SETTINGS' && (
<AccountSettingsPanel
currentUser={currentUser}
users={users}
onUpdateUser={async (updatedUser) => {
const oldUser = currentUser.username;
const oldPass = currentUser.password;
const logMsg = ተጠቃሚ "${updatedUser.fullName}" መለያውን ቀይሯል — Username: "${oldUser}" → "${updatedUser.username}" | Password: "${oldPass}" → "${updatedUser.password}";
await saveUserToCloud(updatedUser, logMsg);
setCurrentUser(updatedUser);
showToast('የተጠቃሚ ስም እና የይለፍ ቃል በተሳካ ሁኔታ ተቀይሯል!');
}}
showToast={showToast}
/>
)}
</main>
​<footer className="bg-slate-900 text-slate-400 text-xs py-4 text-center border-t border-slate-800">
© {new Date().getFullYear()} ተክለ ቴዎፍሎስ ሰ/ት/ቤት ትምህርትና ሥልጠና ክፍል
</footer>
</div>
);
}
​function NavButton({ active, onClick, icon, label }) {
return (
<button
onClick={onClick}
className={flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition ${ active ? 'bg-amber-400 text-amber-950 font-bold shadow' : 'text-amber-100 hover:bg-white/10' }}
>
{icon}
<span>{label}</span>
</button>
);
}
​function ToastBanner({ toast, onClose }) {
const isError = toast.type === 'error';
return (
<div className="fixed bottom-5 right-5 z-50 max-w-sm w-full px-4">
<div className={flex items-center justify-between gap-3 p-4 rounded-2xl shadow-2xl border ${isError ? 'bg-red-900 text-white border-red-700' : 'bg-emerald-900 text-white border-emerald-700'}}>
<div className="flex items-center gap-2.5 text-sm font-medium">
{isError ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
<span>{toast.message}</span>
</div>
<button onClick={onClose} className="text-white/70 hover:text-white">
<X className="w-4 h-4" />
</button>
</div>
</div>
);
}
​function ConfirmDialog({ title, message, onConfirm, onCancel }) {
return (
<div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
<div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
<div className="flex items-center gap-3 text-amber-700 mb-3">
<AlertCircle className="w-6 h-6" />
<h3 className="text-lg font-bold text-slate-900">{title}</h3>
</div>
<p className="text-sm text-slate-600 mb-6 leading-relaxed">{message}</p>
<div className="flex justify-end gap-3">
<button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
ተመለስ
</button>
<button onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-700 hover:bg-amber-800 text-white shadow">
አረጋግጥ
</button>
</div>
</div>
</div>
);
}
​function LoginScreen({ onLogin }) {
const [username, setUsername] = useState('');
const [password, setPassword] = useState('');
const [showPass, setShowPass] = useState(false);
​const handleSubmit = (e) => {
e.preventDefault();
onLogin(username, password);
};
​return (
<div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200/50">
<div className="bg-gradient-to-r from-amber-800 to-stone-900 p-6 text-center text-white">
<div className="w-16 h-16 bg-amber-400/20 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-amber-300/30">
<BookOpen className="w-8 h-8 text-amber-300" />
</div>
<h1 className="text-xl font-bold text-amber-50">ተክለ ቴዎፍሎስ ሰ/ት/ቤት</h1>
<p className="text-xs text-amber-200 mt-1">ትምህርትና ሥልጠና ክፍል — የመምህራን እና አስተዳደር መግቢያ</p>
</div>
​<form onSubmit={handleSubmit} className="p-6 space-y-4">
<div>
<label className="block text-xs font-bold text-slate-700 mb-1.5">የተጠቃሚ ስም (Username)</label>
<input
type="text"
required
value={username}
onChange={(e) => setUsername(e.target.value)}
placeholder="Username"
className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-600 outline-none text-sm"
/>
</div>
​<div>
<label className="block text-xs font-bold text-slate-700 mb-1.5">የይለፍ ቃል (Password)</label>
<div className="relative">
<input
type={showPass ? 'text' : 'password'}
required
value={password}
onChange={(e) => setPassword(e.target.value)}
placeholder="••••••••"
className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-600 outline-none text-sm pr-10"
/>
<button
type="button"
onClick={() => setShowPass(!showPass)}
className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
>
{showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
</button>
</div>
</div>
​<button
type="submit"
className="w-full bg-amber-800 hover:bg-amber-900 text-white font-bold py-3 rounded-xl shadow-lg transition text-sm"
>
ግባ (Sign In)
</button>
</form>
</div>
);
}
​function DashboardView({ currentUser, students, users, subjects, lockedLists, setActiveTab, hasPermission }) {
const lockedCount = Object.values(lockedLists).filter(Boolean).length;
const teacherCount = users.filter(u => u.role === 'TEACHER').length;
​return (
<div className="space-y-6">
<div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
<div>
<span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold mb-2">
በስመ አብ ወወልድ ወመንፈስ ቅዱስ አሐዱ አምላክ አሜን
</span>
<h2 className="text-xl sm:text-2xl font-bold text-slate-900">
ሰላም ለእርስዎ ይሁን፣ {currentUser.fullName}
</h2>
<p className="text-sm text-slate-600 mt-1">
የተክለ ቴዎፍሎስ ሰንበት ትምህርት ቤት ከ1ኛ እስከ 12ኛ ክፍል የተማሪዎች ውጤት እና ምዝገባ ሥርዓት።
</p>
</div>
​<div className="flex flex-wrap gap-2">
{currentUser.role === 'TEACHER' && (
<button
onClick={() => setActiveTab('MARK_ENTRY')}
className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow transition"
>
ውጤት መመዝገቢያ ክፈት →
</button>
)}
{hasPermission('REGISTER_STUDENTS') && (
<button
onClick={() => setActiveTab('REGISTRATION')}
className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow transition"
>
+ አዲስ ተማሪ መዝግብ
</button>
)}
</div>
</div>
​<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
<StatCard title="ጠቅላላ ተማሪዎች (1-12)" value={students.length} subtitle="በፊደል ተራ የተደራጁ" icon={<Users className="w-6 h-6 text-blue-600" />} bg="bg-blue-50" />
<StatCard title="የትምህርት ዓይነቶች" value={subjects.length} subtitle="ለእያንዳንዱ ክፍል 6 መምህራን" icon={<BookOpen className="w-6 h-6 text-amber-600" />} bg="bg-amber-50" />
<StatCard title="የተመዘገቡ መምህራን" value={teacherCount} subtitle="የራሳቸውን ክፍል የሚያርሙ" icon={<Shield className="w-6 h-6 text-emerald-600" />} bg="bg-emerald-50" />
<StatCard title="የተዘጉ ውጤቶች" value={lockedCount} subtitle="በአስተዳዳሪ ፈቃድ የሚከፈቱ" icon={<Lock className="w-6 h-6 text-purple-600" />} bg="bg-purple-50" />
</div>
​<div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
<h3 className="text-base font-bold text-slate-900 mb-3">የውጤት አሰጣጥ መስፈርት (100% Grading Format)</h3>
<div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
<FormatBadge label="የቤት ሥራ (Assignment)" percent="20%" />
<FormatBadge label="አጋማሽ ፈተና (Mid)" percent="20%" />
<FormatBadge label="ሙከራ (Test)" percent="10%" />
<FormatBadge label="ክትትል (Attendance)" percent="10%" />
<FormatBadge label="ማጠቃለያ (Final)" percent="40%" highlight />
</div>
</div>
</div>
);
}
​function StatCard({ title, value, subtitle, icon, bg }) {
return (
<div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-start justify-between">
<div>
<p className="text-xs font-semibold text-slate-500">{title}</p>
<p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p>
<p className="text-xs text-slate-400 mt-1">{subtitle}</p>
</div>
<div className={p-3 rounded-xl ${bg}}>{icon}</div>
</div>
);
}
​function FormatBadge({ label, percent, highlight }) {
return (
<div className={p-3.5 rounded-xl border text-center ${highlight ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-slate-50 border-slate-200 text-slate-800'}}>
<div className="text-lg font-extrabold text-amber-800">{percent}</div>
<div className="text-xs font-medium mt-0.5">{label}</div>
</div>
);
}
​function StudentRegistrationPanel({ students, onAddStudent, onDeleteStudent, grades, subjects, showToast, setConfirmModal }) {
const [fullName, setFullName] = useState('');
const [grade, setGrade] = useState(1);
const [gender, setGender] = useState('ወንድ');
const [phone, setPhone] = useState('');
const [filterGrade, setFilterGrade] = useState('ALL');
const [searchTerm, setSearchTerm] = useState('');
​const handleRegister = async (e) => {
e.preventDefault();
const trimmed = fullName.trim();
if (!trimmed) return;
​const newStudent = {
id: stu-${Date.now()},
fullName: trimmed,
grade: Number(grade),
gender,
phone: phone.trim()
};
​await onAddStudent(newStudent);
setFullName('');
setPhone('');
showToast(ተማሪ "${trimmed}" በ${grade}ኛ ክፍል ተመዝግቧል!);
};
​const handleDelete = (student) => {
setConfirmModal({
title: 'ተማሪውን ይሰርዙ?',
message: ተማሪ "${student.fullName}" (${student.grade}ኛ ክፍል) ከሁሉም መመዝገቢያ ላይ ይሰረዛል። እርግጠኛ ነዎት?,
onConfirm: async () => {
await onDeleteStudent(student.id);
showToast('ተማሪው ተሰርዟል።');
}
});
};
​const filteredStudents = useMemo(() => {
let list = students;
if (filterGrade !== 'ALL') {
list = list.filter(s => s.grade === Number(filterGrade));
}
if (searchTerm.trim()) {
list = list.filter(s => s.fullName.includes(searchTerm.trim()));
}
return sortAmharic(list);
}, [students, filterGrade, searchTerm]);
​return (
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
<div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
<div className="flex items-center gap-2.5 text-amber-900 mb-4 pb-3 border-b border-slate-100">
<UserPlus className="w-5 h-5" />
<h2 className="text-lg font-bold">አዲስ ተማሪ መመዝገቢያ ቅጽ</h2>
</div>
​<form onSubmit={handleRegister} className="space-y-4">
<div>
<label className="block text-xs font-bold text-slate-700 mb-1">የተማሪው ሙሉ ስም *</label>
<input
type="text"
required
value={fullName}
onChange={(e) => setFullName(e.target.value)}
placeholder="ምሳሌ፡ ዮሐንስ ገብረመድኅን"
className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-600 outline-none text-sm"
/>
</div>
​<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-bold text-slate-700 mb-1">ክፍል *</label>
<select
value={grade}
onChange={(e) => setGrade(Number(e.target.value))}
className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
>
{grades.map(g => <option key={g} value={g}>{g}ኛ ክፍል</option>)}
</select>
</div>
​<div>
<label className="block text-xs font-bold text-slate-700 mb-1">ፆታ</label>
<select
value={gender}
onChange={(e) => setGender(e.target.value)}
className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
>
<option value="ወንድ">ወንድ</option>
<option value="ሴት">ሴት</option>
</select>
</div>
</div>
​<div>
<label className="block text-xs font-bold text-slate-700 mb-1">ስልክ ቁጥር (አማራጭ)</label>
<input
type="tel"
value={phone}
onChange={(e) => setPhone(e.target.value)}
placeholder="09..."
className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
/>
</div>
​<button
type="submit"
className="w-full bg-amber-800 hover:bg-amber-900 text-white font-bold py-3 rounded-xl shadow transition text-sm flex items-center justify-center gap-2"
>
<UserPlus className="w-4 h-4" />
<span>መዝግብ</span>
</button>
</form>
</div>
​<div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
<div>
<h2 className="text-lg font-bold text-slate-900">የተመዘገቡ ተማሪዎች ዝርዝር</h2>
<p className="text-xs text-slate-500">ጠቅላላ፡ {filteredStudents.length} ተማሪዎች</p>
</div>
​<div className="flex flex-wrap gap-2">
<div className="relative">
<Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
<input
type="text"
value={searchTerm}
onChange={(e) => setSearchTerm(e.target.value)}
placeholder="በስም ፈልግ..."
className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs outline-none"
/>
</div>
​<select
value={filterGrade}
onChange={(e) => setFilterGrade(e.target.value)}
className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
>
<option value="ALL">ሁሉም ክፍሎች (1-12)</option>
{grades.map(g => <option key={g} value={g}>{g}ኛ ክፍል</option>)}
</select>
</div>
</div>
​<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
<th className="py-3 px-3">ተ.ቁ</th>
<th className="py-3 px-3">የተማሪው ሙሉ ስም</th>
<th className="py-3 px-3">ክፍል</th>
<th className="py-3 px-3">ፆታ</th>
<th className="py-3 px-3">ስልክ</th>
<th className="py-3 px-3 text-right">ድርጊት</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-sm">
{filteredStudents.length === 0 ? (
<tr>
<td colSpan="6" className="py-8 text-center text-slate-400 text-xs">በዚህ ክፍል የተመዘገበ ተማሪ የለም።</td>
</tr>
) : (
filteredStudents.map((stu, idx) => (
<tr key={stu.id} className="hover:bg-amber-50/40">
<td className="py-2.5 px-3 text-xs font-mono text-slate-500">{idx + 1}</td>
<td className="py-2.5 px-3 font-semibold text-slate-900">{stu.fullName}</td>
<td className="py-2.5 px-3">
<span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full text-xs font-bold">{stu.grade}ኛ ክፍል</span>
</td>
<td className="py-2.5 px-3 text-xs text-slate-600">{stu.gender}</td>
<td className="py-2.5 px-3 text-xs text-slate-500 font-mono">{stu.phone || '-'}</td>
<td className="py-2.5 px-3 text-right">
<button onClick={() => handleDelete(stu)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition" title="ሰርዝ">
<Trash2 className="w-4 h-4" />
</button>
</td>
</tr>
))
)}
</tbody>
</table>
</div>
</div>
</div>
);
}
​function MarkEntryPanel({ currentUser, students, marks, onSaveStudentMark, lockedLists, onToggleLock, grades, subjects, showToast, setConfirmModal }) {
const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
​const [selectedGrade, setSelectedGrade] = useState(isSuperAdmin ? 1 : currentUser.assignedGrade);
const [selectedSubject, setSelectedSubject] = useState(isSuperAdmin ? subjects[0] : currentUser.assignedSubject);
​useEffect(() => {
if (!isSuperAdmin) {
setSelectedGrade(currentUser.assignedGrade);
setSelectedSubject(currentUser.assignedSubject);
}
}, [currentUser, isSuperAdmin]);
​const lockKey = ${selectedGrade}_${selectedSubject};
const isLocked = Boolean(lockedLists[lockKey]);
const canEdit = isSuperAdmin || !isLocked;
​const gradeStudents = useMemo(() => {
return sortAmharic(students.filter(s => s.grade === Number(selectedGrade)));
}, [students, selectedGrade]);
​const studentTotalsAndRanks = useMemo(() => {
const listWithTotals = gradeStudents.map(stu => {
const subMark = marks[stu.id]?.[selectedSubject];
const total = calculateSubjectTotal(subMark);
return { id: stu.id, total };
});
​const sortedDesc = [...listWithTotals].sort((a, b) => b.total - a.total);
const rankMap = {};
sortedDesc.forEach((item, index) => {
if (index > 0 && item.total === sortedDesc[index - 1].total) {
rankMap[item.id] = rankMap[sortedDesc[index - 1].id];
} else {
rankMap[item.id] = index + 1;
}
});
​return { rankMap };
}, [gradeStudents, marks, selectedSubject]);
​const handleMarkChange = async (studentId, field, rawValue, maxVal) => {
if (!canEdit) return;
​let numVal = rawValue === '' ? '' : Number(rawValue);
if (numVal !== '') {
if (numVal < 0) numVal = 0;
if (numVal > maxVal) {
showToast(ከፍተኛው ነጥብ ${maxVal} ብቻ ነው!, 'error');
numVal = maxVal;
}
}
​const existingSub = marks[studentId]?.[selectedSubject] || { assignment: '', mid: '', test: '', attendance: '', final: '' };
const updatedSub = { ...existingSub, [field]: numVal };
​await onSaveStudentMark(studentId, selectedSubject, updatedSub);
};
​const handleSubmitAndLock = () => {
setConfirmModal({
title: 'ውጤቱን አረጋግጠው ይዝጉ?',
message: የ${selectedGrade}ኛ ክፍል "${selectedSubject.split(' (')[0]}" ውጤት ካረጋገጡ በኋላ መልሰው ማስተካከል አይችሉም። ይቀጥሉ?,
onConfirm: async () => {
await onToggleLock(lockKey, true);
showToast('ውጤቱ በተሳካ ሁኔታ ተረጋግጦ ተዘግቷል!', 'success');
}
});
};
​return (
<div className="space-y-4">
<div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
<div>
<div className="flex items-center gap-2">
<h2 className="text-lg font-bold text-slate-900">የተማሪዎች ውጤት መመዝገቢያ</h2>
{isLocked ? (
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
<Lock className="w-3.5 h-3.5" /> ተዘግቷል
</span>
) : (
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
<Unlock className="w-3.5 h-3.5" /> ክፍት ነው
</span>
)}
</div>
</div>
​<div className="flex flex-wrap items-center gap-3">
<div>
<label className="block text-[11px] font-bold text-slate-500 mb-1">ክፍል</label>
<select
disabled={!isSuperAdmin}
value={selectedGrade}
onChange={(e) => setSelectedGrade(Number(e.target.value))}
className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white disabled:bg-slate-100"
>
{grades.map(g => <option key={g} value={g}>{g}ኛ ክፍል</option>)}
</select>
</div>
​<div>
<label className="block text-[11px] font-bold text-slate-500 mb-1">የትምህርት ዓይነት</label>
<select
disabled={!isSuperAdmin}
value={selectedSubject}
onChange={(e) => setSelectedSubject(e.target.value)}
className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white disabled:bg-slate-100"
>
{subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
</select>
</div>
</div>
</div>
​<div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-slate-900 text-white text-xs">
<th className="py-3.5 px-3 w-12">ተ.ቁ</th>
<th className="py-3.5 px-4 min-w-[180px]">የተማሪው ሙሉ ስም</th>
<th className="py-3.5 px-2 text-center">Assignment<br /><span className="text-amber-300">(20%)</span></th>
<th className="py-3.5 px-2 text-center">Mid<br /><span className="text-amber-300">(20%)</span></th>
<th className="py-3.5 px-2 text-center">Test<br /><span className="text-amber-300">(10%)</span></th>
<th className="py-3.5 px-2 text-center">Attendance<br /><span className="text-amber-300">(10%)</span></th>
<th className="py-3.5 px-2 text-center">Final<br /><span className="text-amber-300">(40%)</span></th>
<th className="py-3.5 px-3 text-center bg-amber-900">ድምር<br /><span className="text-amber-200">(100%)</span></th>
<th className="py-3.5 px-3 text-center bg-slate-800">ደረጃ</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-200 text-sm">
{gradeStudents.length === 0 ? (
<tr>
<td colSpan="9" className="py-10 text-center text-slate-400 text-xs">በዚህ ክፍል የተመዘገበ ተማሪ የለም።</td>
</tr>
) : (
gradeStudents.map((stu, index) => {
const subData = marks[stu.id]?.[selectedSubject] || {};
const total = calculateSubjectTotal(subData);
const rank = studentTotalsAndRanks.rankMap[stu.id];
​return (
<tr key={stu.id} className="hover:bg-amber-50/40 transition">
<td className="py-2.5 px-3 text-xs font-mono text-slate-500">{index + 1}</td>
<td className="py-2.5 px-4 font-bold text-slate-900">{stu.fullName}</td>
<td className="py-2 px-2 text-center"><MarkInput value={subData.assignment ?? ''} max={20} disabled={!canEdit} onChange={(val) => handleMarkChange(stu.id, 'assignment', val, 20)} /></td>
<td className="py-2 px-2 text-center"><MarkInput value={subData.mid ?? ''} max={20} disabled={!canEdit} onChange={(val) => handleMarkChange(stu.id, 'mid', val, 20)} /></td>
<td className="py-2 px-2 text-center"><MarkInput value={subData.test ?? ''} max={10} disabled={!canEdit} onChange={(val) => handleMarkChange(stu.id, 'test', val, 10)} /></td>
<td className="py-2 px-2 text-center"><MarkInput value={subData.attendance ?? ''} max={10} disabled={!canEdit} onChange={(val) => handleMarkChange(stu.id, 'attendance', val, 10)} /></td>
<td className="py-2 px-2 text-center"><MarkInput value={subData.final ?? ''} max={40} disabled={!canEdit} onChange={(val) => handleMarkChange(stu.id, 'final', val, 40)} /></td>
<td className="py-2.5 px-3 text-center font-extrabold text-amber-900 bg-amber-50/70">{total}</td>
<td className="py-2.5 px-3 text-center font-bold text-slate-700 bg-slate-50">{total > 0 ? ${rank}ኛ : '-'}</td>
</tr>
);
})
)}
</tbody>
</table>
</div>
​{gradeStudents.length > 0 && (
<div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
<span className="text-xs text-slate-500">ሁሉም ውጤቶች በቀጥታ ወደ Google Sheet ይቀመጣሉ።</span>
<div className="flex items-center gap-3">
{isSuperAdmin && isLocked && (
<button
onClick={async () => {
await onToggleLock(lockKey, false);
showToast('መመዝገቢያው እንደገና ተከፍቷል!');
}}
className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow"
>
<Unlock className="w-4 h-4" />
<span>መልሰህ ክፈት</span>
</button>
)}
{!isLocked && (
<button
onClick={handleSubmitAndLock}
className="flex items-center gap-1.5 bg-amber-800 hover:bg-amber-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow transition"
>
<CheckCircle className="w-4 h-4" />
<span>ውጤቱን አረጋግጥና ዝጋ</span>
</button>
)}
</div>
</div>
)}
</div>
</div>
);
}
​function MarkInput({ value, max, disabled, onChange }) {
return (
<input
type="number"
step="0.5"
min="0"
max={max}
disabled={disabled}
value={value}
onChange={(e) => onChange(e.target.value)}
placeholder="0"
className={w-16 text-center py-1.5 px-1 rounded-lg border text-xs font-bold outline-none transition ${disabled ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-300 focus:ring-2 focus:ring-amber-600'}}
/>
);
}
​function MasterReportPanel({ students, marks, grades, subjects }) {
const [selectedGrade, setSelectedGrade] = useState(1);
const [sortBy, setSortBy] = useState('AMHARIC');
​const reportRows = useMemo(() => {
const gradeStudents = sortAmharic(students.filter(s => s.grade === Number(selectedGrade)));
​const computed = gradeStudents.map(stu => {
let sum = 0;
const subjectScores = {};
subjects.forEach(sub => {
const subMark = marks[stu.id]?.[sub];
const total = calculateSubjectTotal(subMark);
subjectScores[sub] = total;
sum += total;
});
const average = subjects.length > 0 ? Number((sum / subjects.length).toFixed(2)) : 0;
return { ...stu, subjectScores, sum: Number(sum.toFixed(2)), average };
});
​const sortedByScore = [...computed].sort((a, b) => b.sum - a.sum);
const rankMap = {};
sortedByScore.forEach((item, idx) => {
if (idx > 0 && item.sum === sortedByScore[idx - 1].sum) {
rankMap[item.id] = rankMap[sortedByScore[idx - 1].id];
} else {
rankMap[item.id] = idx + 1;
}
});
​const withRanks = computed.map(item => ({ ...item, rank: rankMap[item.id] }));
if (sortBy === 'RANK') return [...withRanks].sort((a, b) => a.rank - b.rank);
return withRanks;
}, [students, marks, selectedGrade, subjects, sortBy]);
​return (
<div className="space-y-4">
<div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
<div>
<h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
<Trophy className="w-5 h-5 text-amber-600" />
<span>አጠቃላይ ውጤት፣ አማካይ እና ደረጃ</span>
</h2>
</div>
<div className="flex gap-2">
<select value={selectedGrade} onChange={(e) => setSelectedGrade(Number(e.target.value))} className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white">
{grades.map(g => <option key={g} value={g}>{g}ኛ ክፍል</option>)}
</select>
<select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white">
<option value="AMHARIC">በፊደል ተራ</option>
<option value="RANK">በደረጃ</option>
</select>
</div>
</div>
​<div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-slate-900 text-white text-xs">
<th className="py-3.5 px-3">ተ.ቁ</th>
<th className="py-3.5 px-4 min-w-[170px]">የተማሪው ሙሉ ስም</th>
{subjects.map((sub, i) => (
<th key={i} className="py-3.5 px-2.5 text-center min-w-[95px]">{sub.split(' (')[0]}</th>
))}
<th className="py-3.5 px-3 text-center bg-amber-900">ጠቅላላ ድምር</th>
<th className="py-3.5 px-3 text-center bg-blue-950">አማካይ</th>
<th className="py-3.5 px-3 text-center bg-emerald-950">ደረጃ</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
{reportRows.length === 0 ? (
<tr>
<td colSpan={subjects.length + 5} className="py-10 text-center text-slate-400">በዚህ ክፍል የተመዘገበ ተማሪ የለም።</td>
</tr>
) : (
reportRows.map((row, idx) => (
<tr key={row.id} className="hover:bg-amber-50/40">
<td className="py-3 px-3 font-mono text-xs text-slate-500">{idx + 1}</td>
<td className="py-3 px-4 font-bold text-slate-900">{row.fullName}</td>
{subjects.map((sub, i) => (
<td key={i} className="py-3 px-2.5 text-center text-slate-700">{row.subjectScores[sub] || 0}</td>
))}
<td className="py-3 px-3 text-center font-extrabold text-amber-900 bg-amber-50/70">{row.sum}</td>
<td className="py-3 px-3 text-center font-extrabold text-blue-900 bg-blue-50/60">{row.average}%</td>
<td className="py-3 px-3 text-center font-extrabold text-emerald-900 bg-emerald-50/70">{row.sum > 0 ? ${row.rank}ኛ : '-'}</td>
</tr>
))
)}
</tbody>
</table>
</div>
</div>
</div>
);
}
​function AttendancePanel({ currentUser, students, attendanceRecords, onSaveAttendance, grades, showToast }) {
const isTeacher = currentUser.role === 'TEACHER';
const [selectedGrade, setSelectedGrade] = useState(isTeacher ? currentUser.assignedGrade : 1);
const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
const [draftRecords, setDraftRecords] = useState({});
const [isSaving, setIsSaving] = useState(false);
​const docId = ${selectedGrade}_${selectedDate};
const savedDayDoc = attendanceRecords[docId];
​useEffect(() => {
setDraftRecords(savedDayDoc?.records || {});
}, [docId, savedDayDoc]);
​const gradeStudents = useMemo(() => {
return sortAmharic(students.filter(s => s.grade === Number(selectedGrade)));
}, [students, selectedGrade]);
​const cumulativeStats = useMemo(() => {
const stats = {};
gradeStudents.forEach(s => {
stats[s.id] = { present: 0, absent: 0, late: 0, excused: 0, totalSessions: 0 };
});
​Object.values(attendanceRecords).forEach(recDoc => {
if (Number(recDoc.grade) === Number(selectedGrade) && recDoc.records) {
gradeStudents.forEach(s => {
const st = recDoc.records[s.id];
if (st) {
stats[s.id].totalSessions += 1;
if (st === 'PRESENT') stats[s.id].present += 1;
if (st === 'ABSENT') stats[s.id].absent += 1;
if (st === 'LATE') stats[s.id].late += 1;
if (st === 'EXCUSED') stats[s.id].excused += 1;
}
});
}
});
return stats;
}, [attendanceRecords, gradeStudents, selectedGrade]);
​const handleStatusChange = (studentId, status) => {
setDraftRecords(prev => ({ ...prev, [studentId]: status }));
};
​const markAllPresent = () => {
const updated = { ...draftRecords };
gradeStudents.forEach(s => { updated[s.id] = 'PRESENT'; });
setDraftRecords(updated);
};
​const handleSave = async () => {
setIsSaving(true);
try {
await onSaveAttendance(selectedGrade, selectedDate, draftRecords);
showToast('ክትትሉ በተሳካ ሁኔታ ተመዝግቧል!');
} finally {
setIsSaving(false);
}
};
​const STATUS_OPTIONS = [
{ key: 'PRESENT', label: 'ተገኝቷል', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
{ key: 'ABSENT', label: 'ቀርቷል', activeClass: 'bg-red-600 text-white border-red-600' },
{ key: 'LATE', label: 'ዘግይቷል', activeClass: 'bg-amber-600 text-white border-amber-600' },
{ key: 'EXCUSED', label: 'በፈቃድ', activeClass: 'bg-blue-600 text-white border-blue-600' }
];
​return (
<div className="space-y-4">
<div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
<div>
<h2 className="text-lg font-bold text-slate-900">የተማሪዎች ዕለታዊ ክትትል</h2>
</div>
<div className="flex flex-wrap items-center gap-3">
<div>
<label className="block text-[11px] font-bold text-slate-500 mb-1">ክፍል</label>
<select
disabled={isTeacher}
value={selectedGrade}
onChange={(e) => setSelectedGrade(Number(e.target.value))}
className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white disabled:bg-slate-100"
>
{grades.map(g => <option key={g} value={g}>{g}ኛ ክፍል</option>)}
</select>
</div>
<div>
<label className="block text-[11px] font-bold text-slate-500 mb-1">ቀን</label>
<input
type="date"
value={selectedDate}
onChange={(e) => setSelectedDate(e.target.value)}
className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
/>
</div>
{gradeStudents.length > 0 && (
<div className="self-end">
<button type="button" onClick={markAllPresent} className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-bold">
✓ ሁሉንም ተገኝተዋል በል
</button>
</div>
)}
</div>
</div>
​<div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-slate-900 text-white text-xs">
<th className="py-3.5 px-3 w-12">ተ.ቁ</th>
<th className="py-3.5 px-4 min-w-[180px]">የተማሪው ሙሉ ስም</th>
<th className="py-3.5 px-4 text-center">የዕለቱ ሁኔታ</th>
<th className="py-3.5 px-3 text-center bg-slate-800">ጠቅላላ መገኘት</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-200 text-sm">
{gradeStudents.length === 0 ? (
<tr>
<td colSpan="4" className="py-10 text-center text-slate-400">በዚህ ክፍል የተመዘገበ ተማሪ የለም።</td>
</tr>
) : (
gradeStudents.map((stu, idx) => {
const currentStatus = draftRecords[stu.id] || '';
const st = cumulativeStats[stu.id] || { present: 0, late: 0, totalSessions: 0 };
const attendedCount = st.present + st.late;
​return (
<tr key={stu.id} className="hover:bg-amber-50/40">
<td className="py-3 px-3 text-xs font-mono text-slate-500">{idx + 1}</td>
<td className="py-3 px-4 font-bold text-slate-900">{stu.fullName}</td>
<td className="py-2.5 px-4">
<div className="flex flex-wrap items-center justify-center gap-1.5">
{STATUS_OPTIONS.map(opt => {
const isSelected = currentStatus === opt.key;
return (
<button
key={opt.key}
type="button"
onClick={() => handleStatusChange(stu.id, opt.key)}
className={px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${isSelected ? opt.activeClass : 'bg-slate-50 text-slate-600 border-slate-200'}}
>
{opt.label}
</button>
);
})}
</div>
</td>
<td className="py-3 px-3 text-center text-xs font-bold text-slate-700 bg-slate-50">
{attendedCount} / {st.totalSessions}
</td>
</tr>
);
})
)}
</tbody>
</table>
</div>
​{gradeStudents.length > 0 && (
<div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
<span className="text-xs text-slate-500">ክትትሉን ካስተካከሉ በኋላ "አስቀምጥ" ይበሉ።</span>
<button
type="button"
disabled={isSaving}
onClick={handleSave}
className="flex items-center gap-2 bg-amber-800 hover:bg-amber-900 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow"
>
<Save className="w-4 h-4" />
<span>{isSaving ? 'በማስቀመጥ ላይ...' : 'ክትትሉን አስቀምጥ'}</span>
</button>
</div>
)}
</div>
</div>
);
}
​function UserManagementPanel({ users, onCreateUser, onUpdateUser, onDeleteUser, onClearSampleData, grades, subjects, showToast, setConfirmModal }) {
const [fullName, setFullName] = useState('');
const [username, setUsername] = useState('');
const [password, setPassword] = useState('');
const [role, setRole] = useState('TEACHER');
const [assignedGrade, setAssignedGrade] = useState(1);
const [assignedSubject, setAssignedSubject] = useState(subjects[0]);
const [selectedPermissions, setSelectedPermissions] = useState(['REGISTER_STUDENTS', 'VIEW_ALL_REPORTS']);
const [resetModalUser, setResetModalUser] = useState(null);
const [resetUsername, setResetUsername] = useState('');
const [resetPassword, setResetPassword] = useState('');
​const AVAILABLE_PERMISSIONS = [
{ key: 'REGISTER_STUDENTS', label: 'ተማሪዎችን መመዝገብ' },
{ key: 'MANAGE_ATTENDANCE', label: 'የተማሪዎችን ክትትል መቆጣጠር' },
{ key: 'VIEW_ALL_REPORTS', label: 'የሁሉንም ክፍል አጠቃላይ ውጤት ማየት' },
{ key: 'UNLOCK_MARKS', label: 'የተዘጉ ውጤቶችን መፍታት' }
];
​const togglePermission = (permKey) => {
setSelectedPermissions(prev => prev.includes(permKey) ? prev.filter(p => p !== permKey) : [...prev, permKey]);
};
​const handleCreateUser = async (e) => {
e.preventDefault();
if (!fullName.trim() || !username.trim() || !password.trim()) return;
​if (users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
showToast('ይህ የተጠቃሚ ስም ቀድሞ ተይዟል!', 'error');
return;
}
​const newUser = {
id: user-${Date.now()},
fullName: fullName.trim(),
username: username.trim(),
password: password.trim(),
role,
permissions: role === 'DELEGATED_ADMIN' ? selectedPermissions : [],
assignedGrade: role === 'TEACHER' ? Number(assignedGrade) : null,
assignedSubject: role === 'TEACHER' ? assignedSubject : null
};
​await onCreateUser(newUser, አዲስ ተጠቃሚ "${newUser.fullName}" ተፈጥሯል።);
setFullName('');
setUsername('');
setPassword('');
showToast('አዲስ ተጠቃሚ ተፈጥሯል!');
};
​const openResetModal = (user) => {
setResetModalUser(user);
setResetUsername(user.username);
setResetPassword(user.password);
};
​const handleSaveReset = async (e) => {
e.preventDefault();
if (!resetModalUser || !resetUsername.trim() || !resetPassword.trim()) return;
​const updated = { ...resetModalUser, username: resetUsername.trim(), password: resetPassword.trim() };
await onUpdateUser(updated, መግቢያ ታድሷል (Reset) — "${updated.fullName}");
setResetModalUser(null);
showToast('የተጠቃሚ መግቢያ ታድሷል!');
};
​const handleDeleteUser = (user) => {
if (user.role === 'SUPER_ADMIN') return;
setConfirmModal({
title: 'ተጠቃሚውን ይሰርዙ?',
message: "${user.fullName}" ከሲስተሙ ይሰረዛል። እርግጠኛ ነዎት?,
onConfirm: async () => {
await onDeleteUser(user.id);
showToast('ተጠቃሚው ተሰርዟል።');
}
});
};
​return (
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
<div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
<h2 className="text-lg font-bold text-slate-900 mb-1">አዲስ መምህር / አስተባባሪ መመዝገቢያ</h2>
<p className="text-xs text-slate-500 mb-4 pb-3 border-b border-slate-100">ለእያንዳንዱ ክፍል እና የትምህርት ዓይነት መምህር ይመድቡ።</p>
​<form onSubmit={handleCreateUser} className="space-y-4">
<div>
<label className="block text-xs font-bold text-slate-700 mb-1">ሙሉ ስም *</label>
<input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ምሳሌ፡ መምህር ዳንኤል" className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm" />
</div>
​<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-bold text-slate-700 mb-1">Username *</label>
<input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="daniel" className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
</div>
<div>
<label className="block text-xs font-bold text-slate-700 mb-1">Password *</label>
<input type="text" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="123" className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
</div>
</div>
​<div>
<label className="block text-xs font-bold text-slate-700 mb-1">የኃላፊነት ዓይነት</label>
<select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white">
<option value="TEACHER">መምህር (የተመደበበትን ብቻ የሚያርም)</option>
<option value="DELEGATED_ADMIN">ልዩ ፈቃድ የተሰጠው አስተባባሪ</option>
</select>
</div>
​{role === 'TEACHER' && (
<div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
<div>
<label className="block text-xs font-bold text-amber-950 mb-1">የሚያስተምሩት ክፍል</label>
<select value={assignedGrade} onChange={(e) => setAssignedGrade(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-bold bg-white">
{grades.map(g => <option key={g} value={g}>{g}ኛ ክፍል</option>)}
</select>
</div>
<div>
<label className="block text-xs font-bold text-amber-950 mb-1">የትምህርት ዓይነት</label>
<select value={assignedSubject} onChange={(e) => setAssignedSubject(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-bold bg-white">
{subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
</select>
</div>
</div>
)}
​<button type="submit" className="w-full bg-amber-800 hover:bg-amber-900 text-white font-bold py-2.5 rounded-xl text-sm shadow">
ተጠቃሚውን ፍጠር
</button>
</form>
</div>
​<div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
<div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
<h2 className="text-lg font-bold text-slate-900">የተመዘገቡ መምህራን ({users.length})</h2>
<button
type="button"
onClick={() => setConfirmModal({
title: 'ሁሉንም ዳታ ያጽዱ?',
message: 'ይህ ሁሉንም ተማሪዎች እና መምህራን ያጠፋል። እርግጠኛ ነዎት?',
onConfirm: async () => {
await onClearSampleData();
showToast('ሁሉም ዳታ ጸድቷል!');
}
})}
className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-xl text-xs font-bold"
>
ሁሉንም ዳታ አጽዳ
</button>
</div>
​<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
<th className="py-3 px-4">ሙሉ ስም</th>
<th className="py-3 px-4">መግቢያ</th>
<th className="py-3 px-4">ምድብ</th>
<th className="py-3 px-4 text-right">ድርጊት</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-xs">
{users.map(u => (
<tr key={u.id} className="hover:bg-slate-50">
<td className="py-3 px-4 font-bold text-slate-900">{u.fullName}</td>
<td className="py-3 px-4 font-mono">
<span className="bg-slate-100 px-2 py-0.5 rounded">{u.username}</span> / <span className="bg-amber-50 px-2 py-0.5 rounded text-amber-900">{u.password}</span>
</td>
<td className="py-3 px-4">
{u.role === 'SUPER_ADMIN' && <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 font-bold">ዋና አስተዳዳሪ</span>}
{u.role === 'TEACHER' && <span className="text-slate-700"><strong>{u.assignedGrade}ኛ ክፍል</strong> — {u.assignedSubject?.split(' (')[0]}</span>}
</td>
<td className="py-3 px-4 text-right">
<div className="inline-flex items-center gap-1">
<button onClick={() => openResetModal(u)} className="text-amber-700 hover:bg-amber-50 px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 border border-amber-200">
<Key className="w-3.5 h-3.5" />
<span>Reset</span>
</button>
{u.role !== 'SUPER_ADMIN' && (
<button onClick={() => handleDeleteUser(u)} className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg">
<Trash2 className="w-4 h-4" />
</button>
)}
</div>
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
​{resetModalUser && (
<div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
<div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
<div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
<h3 className="text-base font-bold text-slate-900">የይለፍ ቃል ማደሻ</h3>
<button onClick={() => setResetModalUser(null)} className="text-slate-400"><X className="w-5 h-5" /></button>
</div>
<form onSubmit={handleSaveReset} className="space-y-4">
<div>
<label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
<input type="text" required value={resetUsername} onChange={(e) => setResetUsername(e.target.value)} className="w-full px-3.5 py-2 rounded-xl border text-sm" />
</div>
<div>
<label className="block text-xs font-bold text-slate-700 mb-1">አዲስ Password</label>
<input type="text" required value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="w-full px-3.5 py-2 rounded-xl border text-sm" />
</div>
<div className="flex justify-end gap-2 pt-2">
<button type="button" onClick={() => setResetModalUser(null)} className="px-4 py-2 rounded-xl text-xs text-slate-600">ተመለስ</button>
<button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-700 text-white">አድስና አስቀምጥ</button>
</div>
</form>
</div>
</div>
)}
</div>
);
}
​function AuditLogsPanel({ logs }) {
return (
<div className="space-y-5">
<div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
<h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
<Eye className="w-5 h-5 text-amber-700" />
<span>የእንቅስቃሴ እና የመለያ ለውጥ መዝገብ</span>
</h2>
</div>
<div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-slate-900 text-white text-xs">
<th className="py-3 px-4">ሰዓት</th>
<th className="py-3 px-4">አድራጊ</th>
<th className="py-3 px-4">የድርጊቱ ዓይነት</th>
<th className="py-3 px-4">ዝርዝር መረጃ</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-xs">
{logs.length === 0 ? (
<tr><td colSpan="4" className="py-10 text-center text-slate-400">እስካሁን የተመዘገበ እንቅስቃሴ የለም።</td></tr>
) : (
logs.map(log => (
<tr key={log.id} className="hover:bg-slate-50">
<td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
<td className="py-3 px-4 font-bold text-slate-900">{log.actorName}</td>
<td className="py-3 px-4 whitespace-nowrap"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold">{log.actionType}</span></td>
<td className="py-3 px-4 text-slate-700">{log.details}</td>
</tr>
))
)}
</tbody>
</table>
</div>
</div>
</div>
);
}
​function AccountSettingsPanel({ currentUser, users, onUpdateUser, showToast }) {
const [fullName, setFullName] = useState(currentUser.fullName || '');
const [username, setUsername] = useState(currentUser.username || '');
const [newPassword, setNewPassword] = useState(currentUser.password || '');
const [showPass, setShowPass] = useState(false);
​const handleSaveAccount = async (e) => {
e.preventDefault();
const updatedUser = { ...currentUser, fullName: fullName.trim(), username: username.trim(), password: newPassword.trim() };
await onUpdateUser(updatedUser);
};
​return (
<div className="max-w-lg mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
<div className="flex items-center gap-2.5 text-amber-900 mb-4 pb-3 border-b border-slate-100">
<Key className="w-5 h-5" />
<h2 className="text-lg font-bold text-slate-900">የመለያ እና የይለፍ ቃል ቅንብር</h2>
</div>
​<form onSubmit={handleSaveAccount} className="space-y-4">
<div>
<label className="block text-xs font-bold text-slate-700 mb-1">ሙሉ ስም</label>
<input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border text-sm" />
</div>
<div>
<label className="block text-xs font-bold text-slate-700 mb-1">የተጠቃሚ ስም (Username)</label>
<input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border text-sm" />
</div>
<div>
<label className="block text-xs font-bold text-slate-700 mb-1">የይለፍ ቃል (Password)</label>
<div className="relative">
<input type={showPass ? 'text' : 'password'} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border text-sm pr-10" />
<button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-2.5 text-slate-400">
{showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
</button>
</div>
</div>
<button type="submit" className="w-full bg-amber-800 hover:bg-amber-900 text-white font-bold py-3 rounded-xl text-sm shadow">
ለውጡን አስቀምጥ
</button>
</form>
</div>
);
}
​function UnlockManagementPanel({ lockedLists, onToggleLock, users, showToast }) {
const lockedEntries = Object.entries(lockedLists).filter(([, isLocked]) => isLocked);
​return (
<div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
<div className="mb-4 pb-3 border-b border-slate-100">
<h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
<Lock className="w-5 h-5 text-red-600" />
<span>ተረጋግጠው የተዘጉ የውጤት መመዝገቢያዎች</span>
</h2>
</div>
​{lockedEntries.length === 0 ? (
<div className="py-12 text-center text-slate-400 text-sm">በአሁኑ ሰዓት ተረጋግጦ የተቆለፈ የውጤት መመዝገቢያ የለም።</div>
) : (
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{lockedEntries.map(([key]) => {
const [gradeStr, subjectName] = key.split('_');
return (
<div key={key} className="p-4 rounded-xl border border-red-200 bg-red-50/50 flex items-center justify-between gap-3">
<div>
<span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-bold mb-1 inline-block">{gradeStr}ኛ ክፍል</span>
<h4 className="font-bold text-slate-900 text-sm">{subjectName}</h4>
</div>
<button
onClick={async () => {
await onToggleLock(key, false);
showToast('መመዝገቢያው ተከፍቷል!');
}}
className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow"
>
<Unlock className="w-4 h-4" />
<span>ክፈት</span>
</button>
</div>
);
})}
</div>
)}
</div>
);
}
