"use client";

import Image from 'next/image';
import background from '../../../public/backgrounds/scholarship-bg.jpg';
import { useState } from "react"; // Keep useState if menuOpen might be used later
import { useRouter } from "next/navigation";
// Removed Menu, X imports as they aren't used in the provided JSX for this page
// Removed motion import
import Layout from "@/app/components/layout"; // Verify path
// Removed useTheme import - styling handled by Tailwind dark class
// import { useTheme } from "@/context/ThemeContext";

export default function ScholarshipScreen() {
  // Kept state/navigation logic from original structure in case it's needed, though not used in the current JSX
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const navigateTo = (path: string) => {
    setMenuOpen(false);
    router.push(path);
  };

  return (
    <Layout backgroundImageSrc={background}>

      <div className="relative min-h-screen">
         {/* Background Image - Using -z-9 as requested */}
         

        {/* Main container uses dark: variants */}
        <div className="max-w-4xl mx-auto p-6 md:p-8 backdrop-blur-lg rounded-xl shadow-lg bg-white/95 text-gray-900 dark:bg-gray-900/90 dark:text-gray-100">
          {/* Page Title */}
          <h1 className="text-3xl font-bold text-center mb-8 text-black dark:text-white">General Scholarship Information</h1>

          {/* Introduction Section */}
          <div className="mb-8">
             {/* Use dark: variants for text */}
            <p className="text-lg mb-4 text-gray-700 dark:text-gray-300">
              In general, there are three different kinds of scholarship opportunities available:
            </p>
             {/* Ensure list items inherit or have dark text color */}
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
              <li>Government Scholarships</li>
              <li>School Scholarships</li>
              <li>Third Party Scholarships</li>
            </ul>
          </div>

          {/* Government Scholarships Section */}
          <div className="mb-8 p-4 border-t border-gray-200 dark:border-gray-700">
             {/* Use dark: variants for headings and text */}
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Government Scholarships</h2>
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              These scholarships are issued by the United States government in one way or another.
            </p>
            <p className="mb-4 text-gray-700 dark:text-gray-300">Some prominent examples include:</p>
             {/* Ensure list items inherit or have dark text color */}
            <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700 dark:text-gray-300 pl-4">
              <li>The Benjamin A. Gilman Scholarship</li>
              <li>The Boren Awards</li>
              <li>The Critical Language Scholarship (CLS) Program</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300">
              This is by no means an exhaustive list. There are plenty of other government-sponsored scholarships. Visit{" "}
              {/* Use dark: variants for link */}
              <a
                className="underline text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                href="https://studyabroad.state.gov/us-government-scholarships-and-programs/us-college-and-university-students"
                target="_blank"
                rel="noopener noreferrer"
              >
                this official U.S. Department of State link
              </a>{" "}
              for more options.
            </p>
          </div>

          {/* School Scholarships Section */}
          <div className="mb-8 p-4 border-t border-gray-200 dark:border-gray-700">
            {/* Use dark: variants for headings and text */}
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">School Scholarships</h2>
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              These scholarships are issued by your specific university or college, normally managed by the Office of International Programs, Study Abroad Office, or Financial Aid Office.
            </p>
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              Available scholarships differ significantly between institutions. It's essential to get in contact with Study Abroad advisors at your school for the most accurate and relevant information!
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              For UT Tyler students, visit{" "}
              {/* Use dark: variants for link */}
              <a
                className="underline text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                href="https://www.uttyler.edu/student-life/study-abroad/scholarships/"
                target="_blank"
                rel="noopener noreferrer"
              >
                the UT Tyler Study Abroad scholarship page
              </a>{" "}
              for details on opportunities like IEFS and DBB.
            </p>
          </div>

          {/* Third Party Scholarships Section */}
          <div className="mb-8 p-4 border-t border-gray-200 dark:border-gray-700">
             {/* Use dark: variants for headings and text */}
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Third Party Scholarships</h2>
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              These scholarships typically come from private organizations, foundations, or companies with a mission related to international education, specific fields of study, or supporting particular student demographics.
            </p>
            <p className="mb-4 text-gray-700 dark:text-gray-300">Some examples include:</p>
             {/* Ensure list items inherit or have dark text color */}
            <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700 dark:text-gray-300 pl-4">
              <li>Fund for Education Abroad (FEA)</li>
              <li>Freeman-ASIA</li>
              <li>Diversity Abroad</li>
              <li>GoOverseas / GoAbroad Scholarships</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300">
              This category is vast, with numerous scholarships available. Deadlines and eligibility vary widely. Again, your university's Study Abroad office is often the best resource for curated lists and guidance on finding reputable third-party funding. Online scholarship search engines can also be helpful.
            </p>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-8 p-4 border-t border-gray-200 dark:border-gray-700">
             {/* Use dark: variants for heading and link */}
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Ready to Plan?
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300">
                 Check out the{" "}
                 <a
                    // Use router for internal navigation if preferred, or keep href
                    onClick={() => navigateTo('/scholarshipplan')}
                    className="underline cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    // href="/scholarshipplan" // Alternative if not using router.push
                 >
                    Scholarship Planner
                 </a>{" "}
                 page to track deadlines and manage the scholarships listed above (and more!).
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}