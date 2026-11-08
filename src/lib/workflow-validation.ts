export function sendBlockReason(x:{status:string;email:string|null;subject:string;body:string;suppressed:boolean;sent:boolean}):string|null {
  if(x.sent||!['pending_approval','edited'].includes(x.status))return 'This draft has already been approved or sent.';
  if(x.suppressed)return 'This contact is suppressed. Sending is blocked.';
  if(!x.email||!/^\S+@\S+\.\S+$/.test(x.email))return 'Contact has no valid email on file — cannot send.';
  if(!x.subject.trim()||!x.body.trim())return 'Subject and body are required.';
  return null;
}
