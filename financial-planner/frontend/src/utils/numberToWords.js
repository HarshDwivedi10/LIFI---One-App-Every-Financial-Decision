export function numberToIndianWords(num) {
  if (!num || isNaN(num) || num <= 0) return '';
  const val = Math.floor(Number(num));
  if (val === 0) return '';
  
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
    'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (n) => {
    if (n === 0) return '';
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n] + ' ';
    }
    return str.trim();
  };

  let res = '';
  
  let crores = Math.floor(val / 10000000);
  let lakhs = Math.floor((val % 10000000) / 100000);
  let thousands = Math.floor((val % 100000) / 1000);
  let remainder = val % 1000;

  if (crores > 0) {
    if (crores > 99) {
      // For thousands of crores
      let croreThousands = Math.floor(crores / 100);
      let croreRemainder = crores % 100;
      if (croreThousands > 0) {
        res += convertLessThanOneThousand(croreThousands) + ' Hundred ';
      }
      if (croreRemainder > 0) {
        res += convertLessThanOneThousand(croreRemainder) + ' Crore ';
      } else {
        res += 'Crore ';
      }
    } else {
      res += convertLessThanOneThousand(crores) + ' Crore ';
    }
  }
  if (lakhs > 0) {
    res += convertLessThanOneThousand(lakhs) + ' Lakh ';
  }
  if (thousands > 0) {
    res += convertLessThanOneThousand(thousands) + ' Thousand ';
  }
  if (remainder > 0) {
    res += convertLessThanOneThousand(remainder);
  }

  return res.trim() + ' Rupees Only';
}
