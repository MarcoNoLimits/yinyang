import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import UsersSmallBoxesBox from "../components/AdminEditUsersComponents/UsersSmallBoxes_Box";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../config/supabaseClient";

interface User {
    userId: string | number;
    username: string;
    roles: string[];
    userImg?: string;
}

function AdminEditUsers()
{
    const [toggleModerator,setToggleModerator] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState(''); // 🔍 New: search state

    const location = useLocation();
    const username = location.state?.username;
    if (!username) {
        return <Navigate to="/Login" replace />;
    }

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from("users")
                .select("user_id, username, role, user_img")
                .order("username", { ascending: true });

            if (error) throw error;

            if (data) {
                const transformedData = data.map((user: any) => ({
                    userId: user.user_id,
                    username: user.username,
                    roles: [user.role],
                    userImg: user.user_img || "https://www.freeiconspng.com/uploads/computer-user-icon-28.png",
                }));
                setUsers(transformedData);
            }
        } catch (err) {
            setError('Failed to fetch users');
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };
    

    function handleModerator()
    {
        setToggleModerator(true);
    }

    function handleUser()
    {
        setToggleModerator(false);
    }

    const handleRoleToggle = async (userId: string | number) => {
        try {
            console.log('Toggling role for user:', userId); // Debug log
            const userToToggle = users.find(u => u.userId === userId);
            if (!userToToggle) return;

            const currentRole = userToToggle.roles[0];
            const newRole = currentRole === "moderator" ? "user" : "moderator";

            const { error } = await supabase
                .from("users")
                .update({ role: newRole })
                .eq("user_id", userId);

            if (error) throw error;

            console.log('Role toggled successfully'); // Debug log
            await fetchUsers(); // Refresh the user list
        } catch (err) {
            console.error('Error toggling user role:', err);
            setError(err instanceof Error ? err.message : 'Failed to toggle user role');
        }
    };

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div>
                <NavBar admin={true} logged={true}/>
                <div className="flex justify-center items-center h-screen">
                    <div className="text-white">Loading...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <NavBar admin={true} logged={true}/>
                <div className="flex justify-center items-center h-screen">
                    <div className="text-red-500">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <NavBar admin={true} logged={true} />
            <div className='w-full min-w-[800px] flex flex-col gap-10 items-center'>
                <div className={`mt-10 flex gap-6`}>
                    <button className={`transition-colors duration-500 ease-in-out text-[#2f2f2f] px-[20px] py-[10px] rounded-xl ${toggleModerator ? 'bg-[#ffffff]' :'border border-[#303136] bg-transparent text-[#ffffff]'}`} onClick={handleModerator}> {'Moderator'}</button>
                    <button className={`transition-colors duration-500 ease-in-out text-[#2f2f2f] px-[20px] py-[10px] rounded-xl ${toggleModerator ? 'border border-[#303136] bg-transparent text-[#ffffff]' :'bg-[#ffffff]'}`} onClick={handleUser}> {'User'}</button>
                </div>

                <div className="flex flex-col items-center w-full max-w-md">
                    <input
                        type="text"
                        placeholder="Search username"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="mt-1 bg-[#2F2F2F] rounded-xl p-2 pl-4 outline-none"
                    />
                </div>

                <UsersSmallBoxesBox 
                    users={filteredUsers} 
                    moderator={toggleModerator}
                    onRoleToggle={handleRoleToggle}
                />
            </div>
        </div>
    );
}

export default AdminEditUsers;
