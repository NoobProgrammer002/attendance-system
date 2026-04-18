const sname = document.getElementById("name")
 const branch = document.getElementById("branch")
const rollno  = document.getElementById('rollno')
const image = document.getElementById("image")




const button = document.getElementById('generate-bttn')


button.addEventListener("click", function() {
  const namevalue = sname.value.trim();
  const branchvalue = branch.value.trim();
  const rollnovalue = rollno.value.trim();
  if (!namevalue || !branchvalue || !rollnovalue) {
  // show error, fields are empty
} else {
  image.src = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data={"name":"${namevalue}","roll":"${rollnovalue}","branch":"${branchvalue}"}`;
}
    
});
   
   


